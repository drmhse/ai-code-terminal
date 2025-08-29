const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Service for managing terminal layouts and multiplexing configurations
 */
class TerminalLayoutService {
    /**
     * Get or create default layout for a workspace
     * @param {string} workspaceId - Workspace ID
     * @returns {Object} Layout object
     */
    async getDefaultLayout(workspaceId) {
        try {
            // Try to find existing default layout
            let layout = await prisma.terminalLayout.findFirst({
                where: {
                    workspaceId,
                    isDefault: true
                },
                include: {
                    sessions: {
                        where: { status: 'active' },
                        orderBy: { createdAt: 'asc' }
                    }
                }
            });

            if (!layout) {
                // Create default layout if none exists
                layout = await this.createDefaultLayout(workspaceId);
            }

            return layout;
        } catch (error) {
            logger.error(`Error getting default layout for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Create a default terminal layout for a workspace
     * @param {string} workspaceId - Workspace ID
     * @returns {Object} Created layout
     */
    async createDefaultLayout(workspaceId) {
        try {
            const defaultConfig = {
                type: 'tabs',
                tabs: [
                    {
                        id: 'tab-1',
                        name: 'Terminal',
                        active: true,
                        sessionName: 'Terminal'
                    }
                ]
            };

            const layout = await prisma.terminalLayout.create({
                data: {
                    workspaceId,
                    name: 'Default',
                    layoutType: 'tabs',
                    configuration: JSON.stringify(defaultConfig),
                    isDefault: true
                },
                include: {
                    sessions: true
                }
            });

            logger.info(`Created default layout for workspace ${workspaceId}`);
            return layout;
        } catch (error) {
            logger.error(`Error creating default layout for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new terminal layout
     * @param {string} workspaceId - Workspace ID
     * @param {string} name - Layout name
     * @param {string} layoutType - Layout type (tabs, horizontal-split, etc.)
     * @param {Object} configuration - Layout configuration object
     * @returns {Object} Created layout
     */
    async createLayout(workspaceId, name, layoutType, configuration) {
        try {
            const layout = await prisma.terminalLayout.create({
                data: {
                    workspaceId,
                    name,
                    layoutType,
                    configuration: JSON.stringify(configuration),
                    isDefault: false
                }
            });

            logger.info(`Created layout "${name}" for workspace ${workspaceId}`);
            return layout;
        } catch (error) {
            logger.error(`Error creating layout for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Update an existing layout configuration
     * @param {string} layoutId - Layout ID
     * @param {Object} configuration - New configuration
     * @returns {Object} Updated layout
     */
    async updateLayoutConfiguration(layoutId, configuration) {
        try {
            const layout = await prisma.terminalLayout.update({
                where: { id: layoutId },
                data: {
                    configuration: JSON.stringify(configuration),
                    updatedAt: new Date()
                }
            });

            logger.debug(`Updated layout configuration for ${layoutId}`);
            return layout;
        } catch (error) {
            logger.error(`Error updating layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Get all layouts for a workspace
     * @param {string} workspaceId - Workspace ID
     * @returns {Array} Array of layouts
     */
    async getWorkspaceLayouts(workspaceId) {
        try {
            const layouts = await prisma.terminalLayout.findMany({
                where: { workspaceId },
                include: {
                    sessions: {
                        where: { status: 'active' },
                        select: {
                            id: true,
                            sessionName: true,
                            sessionType: true,
                            isDefaultSession: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: [
                    { isDefault: 'desc' },
                    { createdAt: 'asc' }
                ]
            });

            return layouts;
        } catch (error) {
            logger.error(`Error getting layouts for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Delete a layout (cannot delete default layout)
     * @param {string} layoutId - Layout ID
     * @returns {boolean} Success status
     */
    async deleteLayout(layoutId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            if (layout.isDefault) {
                throw new Error('Cannot delete default layout');
            }

            // First, move any sessions to the default layout
            const defaultLayout = await this.getDefaultLayout(layout.workspaceId);
            
            await prisma.session.updateMany({
                where: { layoutId },
                data: { layoutId: defaultLayout.id }
            });

            // Then delete the layout
            await prisma.terminalLayout.delete({
                where: { id: layoutId }
            });

            logger.info(`Deleted layout ${layoutId}`);
            return true;
        } catch (error) {
            logger.error(`Error deleting layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Add a new terminal tab to a layout
     * @param {string} layoutId - Layout ID
     * @param {string} tabName - Name for the new tab
     * @returns {Object} Updated configuration
     */
    async addTabToLayout(layoutId, tabName = 'New Terminal') {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            // Generate new tab ID
            const newTabId = `tab-${Date.now()}`;
            
            // Deactivate other tabs
            config.tabs.forEach(tab => tab.active = false);
            
            // Add new tab
            config.tabs.push({
                id: newTabId,
                name: tabName,
                active: true,
                sessionName: tabName
            });

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
            
            logger.debug(`Added tab "${tabName}" to layout ${layoutId}`);
            return {
                layout: updatedLayout,
                tabId: newTabId,
                configuration: config
            };
        } catch (error) {
            logger.error(`Error adding tab to layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Remove a tab from a layout
     * @param {string} layoutId - Layout ID
     * @param {string} tabId - Tab ID to remove
     * @returns {Object} Updated configuration
     */
    async removeTabFromLayout(layoutId, tabId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            // Find and remove the tab
            const tabIndex = config.tabs.findIndex(tab => tab.id === tabId);
            if (tabIndex === -1) {
                throw new Error('Tab not found');
            }

            const removedTab = config.tabs[tabIndex];
            config.tabs.splice(tabIndex, 1);

            // If we removed the active tab, make another tab active
            if (removedTab.active && config.tabs.length > 0) {
                config.tabs[0].active = true;
            }

            // Ensure we don't remove all tabs
            if (config.tabs.length === 0) {
                config.tabs.push({
                    id: 'tab-default',
                    name: 'Terminal',
                    active: true,
                    sessionName: 'Terminal'
                });
            }

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
            
            logger.debug(`Removed tab ${tabId} from layout ${layoutId}`);
            return {
                layout: updatedLayout,
                configuration: config
            };
        } catch (error) {
            logger.error(`Error removing tab from layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Set active tab in a layout
     * @param {string} layoutId - Layout ID
     * @param {string} tabId - Tab ID to make active
     * @returns {Object} Updated configuration
     */
    async setActiveTab(layoutId, tabId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            // Deactivate all tabs and activate the specified one
            let tabFound = false;
            config.tabs.forEach(tab => {
                tab.active = tab.id === tabId;
                if (tab.id === tabId) {
                    tabFound = true;
                }
            });

            if (!tabFound) {
                throw new Error('Tab not found');
            }

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
            
            logger.debug(`Set active tab ${tabId} in layout ${layoutId}`);
            return {
                layout: updatedLayout,
                configuration: config
            };
        } catch (error) {
            logger.error(`Error setting active tab in layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Create or update a split layout for a workspace
     * @param {string} workspaceId - Workspace ID
     * @param {string} layoutType - Split type (horizontal-split, vertical-split, grid-2x2, three-pane)
     * @param {Array} sessionIds - Array of session IDs to arrange in panes
     * @returns {Object} Updated layout
     */
    async createSplitLayout(workspaceId, layoutType, sessionIds = []) {
        try {
            const layout = await this.getDefaultLayout(workspaceId);
            
            // Create split configuration based on layout type and sessions
            const splitConfig = this.generateSplitConfiguration(layoutType, sessionIds);
            
            const updatedLayout = await this.updateLayoutConfiguration(layout.id, splitConfig);
            
            // Update the layout type
            await prisma.terminalLayout.update({
                where: { id: layout.id },
                data: { layoutType }
            });
            
            logger.info(`Created ${layoutType} layout for workspace ${workspaceId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error creating split layout for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Generate split pane configuration based on layout type (IDE-style)
     * @param {string} layoutType - Layout type
     * @param {Array} sessionIds - Session IDs to arrange
     * @returns {Object} Configuration object
     */
    generateSplitConfiguration(layoutType, sessionIds) {
        const baseConfig = {
            type: layoutType,
            panes: []
        };

        // Distribute sessions across panes
        const distributeSessions = (paneCount) => {
            const sessionsPerPane = Math.ceil(sessionIds.length / paneCount);
            const distribution = [];
            
            for (let i = 0; i < paneCount; i++) {
                const startIdx = i * sessionsPerPane;
                const endIdx = Math.min(startIdx + sessionsPerPane, sessionIds.length);
                distribution.push(sessionIds.slice(startIdx, endIdx));
            }
            
            // Ensure each pane has at least one session (create new ones if needed)
            distribution.forEach((paneSessions, index) => {
                if (paneSessions.length === 0 && sessionIds.length < paneCount) {
                    paneSessions.push(null); // Will be filled by MultiplexShellService
                }
            });
            
            return distribution;
        };

        switch (layoutType) {
            case 'horizontal-split':
                const hSessions = distributeSessions(2);
                baseConfig.panes = [
                    { 
                        id: 'pane-left', 
                        position: 'left',
                        gridArea: '1 / 1 / 2 / 2',
                        tabs: hSessions[0].map(sessionId => ({ sessionId, isActive: false })),
                        activeTabId: hSessions[0][0] || null
                    },
                    { 
                        id: 'pane-right', 
                        position: 'right',
                        gridArea: '1 / 2 / 2 / 3',
                        tabs: hSessions[1].map(sessionId => ({ sessionId, isActive: false })),
                        activeTabId: hSessions[1][0] || null
                    }
                ];
                break;
                
            case 'vertical-split':
                const vSessions = distributeSessions(2);
                baseConfig.panes = [
                    { 
                        id: 'pane-top', 
                        position: 'top',
                        gridArea: '1 / 1 / 2 / 2',
                        tabs: vSessions[0].map(sessionId => ({ sessionId, isActive: false })),
                        activeTabId: vSessions[0][0] || null
                    },
                    { 
                        id: 'pane-bottom', 
                        position: 'bottom',
                        gridArea: '2 / 1 / 3 / 2',
                        tabs: vSessions[1].map(sessionId => ({ sessionId, isActive: false })),
                        activeTabId: vSessions[1][0] || null
                    }
                ];
                break;
                
            case 'grid-2x2':
                const gridSessions = distributeSessions(4);
                baseConfig.panes = [
                    { id: 'pane-tl', position: 'top-left', gridArea: '1 / 1 / 2 / 2', 
                      tabs: gridSessions[0].map(sessionId => ({ sessionId, isActive: false })),
                      activeTabId: gridSessions[0][0] || null },
                    { id: 'pane-tr', position: 'top-right', gridArea: '1 / 2 / 2 / 3', 
                      tabs: gridSessions[1].map(sessionId => ({ sessionId, isActive: false })),
                      activeTabId: gridSessions[1][0] || null },
                    { id: 'pane-bl', position: 'bottom-left', gridArea: '2 / 1 / 3 / 2', 
                      tabs: gridSessions[2].map(sessionId => ({ sessionId, isActive: false })),
                      activeTabId: gridSessions[2][0] || null },
                    { id: 'pane-br', position: 'bottom-right', gridArea: '2 / 2 / 3 / 3', 
                      tabs: gridSessions[3].map(sessionId => ({ sessionId, isActive: false })),
                      activeTabId: gridSessions[3][0] || null }
                ];
                break;
                
            case 'three-pane':
                const threeSessions = distributeSessions(3);
                baseConfig.panes = [
                    { id: 'pane-main', position: 'main', gridArea: '1 / 1 / 3 / 2', 
                      tabs: threeSessions[0].map(sessionId => ({ sessionId, isActive: false })),
                      activeTabId: threeSessions[0][0] || null },
                    { id: 'pane-top-right', position: 'top-right', gridArea: '1 / 2 / 2 / 3', 
                      tabs: threeSessions[1].map(sessionId => ({ sessionId, isActive: false })),
                      activeTabId: threeSessions[1][0] || null },
                    { id: 'pane-bottom-right', position: 'bottom-right', gridArea: '2 / 2 / 3 / 3', 
                      tabs: threeSessions[2].map(sessionId => ({ sessionId, isActive: false })),
                      activeTabId: threeSessions[2][0] || null }
                ];
                break;
                
            default: // fallback to tabs
                baseConfig.type = 'tabs';
                baseConfig.tabs = sessionIds.map((sessionId, index) => ({
                    id: `tab-${index + 1}`,
                    name: `Terminal ${index + 1}`,
                    active: index === 0,
                    sessionId: sessionId
                }));
        }

        // Set first tab as active in each pane
        if (baseConfig.panes) {
            baseConfig.panes.forEach(pane => {
                if (pane.tabs && pane.tabs.length > 0) {
                    pane.tabs[0].isActive = true;
                }
            });
        }

        return baseConfig;
    }

    /**
     * Convert current layout to split panes
     * @param {string} workspaceId - Workspace ID
     * @param {string} targetLayoutType - Target layout type
     * @returns {Object} Updated layout
     */
    async convertToSplit(workspaceId, targetLayoutType) {
        try {
            const currentLayout = await this.getDefaultLayout(workspaceId);
            const config = JSON.parse(currentLayout.configuration);
            
            // Extract session IDs from current tabs
            let sessionIds = [];
            if (config.tabs) {
                sessionIds = config.tabs.map(tab => tab.sessionId).filter(id => id);
            }
            
            // Create new sessions if needed for the layout
            const requiredPanes = this.getRequiredPanesCount(targetLayoutType);
            while (sessionIds.length < requiredPanes) {
                sessionIds.push(null); // Will be filled by MultiplexShellService
            }
            
            return await this.createSplitLayout(workspaceId, targetLayoutType, sessionIds);
        } catch (error) {
            logger.error(`Error converting layout to split for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Convert split layout back to tabs
     * @param {string} workspaceId - Workspace ID
     * @returns {Object} Updated layout
     */
    async convertToTabs(workspaceId) {
        try {
            const currentLayout = await this.getDefaultLayout(workspaceId);
            const config = JSON.parse(currentLayout.configuration);
            
            // Extract session IDs from panes
            let sessionIds = [];
            if (config.panes) {
                sessionIds = config.panes.map(pane => pane.sessionId).filter(id => id);
            }
            
            // Create tabs configuration
            const tabsConfig = {
                type: 'tabs',
                tabs: sessionIds.map((sessionId, index) => ({
                    id: `tab-${index + 1}`,
                    name: `Terminal ${index + 1}`,
                    active: index === 0,
                    sessionId: sessionId
                }))
            };
            
            // If no sessions, create default tab
            if (tabsConfig.tabs.length === 0) {
                tabsConfig.tabs.push({
                    id: 'tab-1',
                    name: 'Terminal',
                    active: true,
                    sessionName: 'Terminal'
                });
            }
            
            const updatedLayout = await this.updateLayoutConfiguration(currentLayout.id, tabsConfig);
            
            // Update layout type
            await prisma.terminalLayout.update({
                where: { id: currentLayout.id },
                data: { layoutType: 'tabs' }
            });
            
            logger.info(`Converted layout to tabs for workspace ${workspaceId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error converting to tabs for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Assign session to a specific pane
     * @param {string} layoutId - Layout ID
     * @param {string} paneId - Pane ID
     * @param {string} sessionId - Session ID to assign
     * @returns {Object} Updated configuration
     */
    async assignSessionToPane(layoutId, paneId, sessionId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            if (config.panes) {
                const pane = config.panes.find(p => p.id === paneId);
                if (pane) {
                    pane.sessionId = sessionId;
                    const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
                    logger.debug(`Assigned session ${sessionId} to pane ${paneId}`);
                    return updatedLayout;
                }
            }
            
            throw new Error('Pane not found');
        } catch (error) {
            logger.error(`Error assigning session to pane:`, error);
            throw error;
        }
    }

    /**
     * Get required number of panes for a layout type
     * @param {string} layoutType - Layout type
     * @returns {number} Number of panes required
     */
    getRequiredPanesCount(layoutType) {
        switch (layoutType) {
            case 'horizontal-split':
            case 'vertical-split':
                return 2;
            case 'three-pane':
                return 3;
            case 'grid-2x2':
                return 4;
            default:
                return 1;
        }
    }

    /**
     * Check if split layouts are supported on current viewport
     * @param {number} viewportWidth - Viewport width in pixels
     * @param {string} layoutType - Desired layout type
     * @returns {boolean} Whether layout is supported
     */
    isSplitLayoutSupported(viewportWidth, layoutType) {
        // Mobile: only tabs
        if (viewportWidth <= 768) {
            return layoutType === 'tabs';
        }
        
        // Tablet: simple splits only
        if (viewportWidth <= 1024) {
            return ['tabs', 'horizontal-split', 'vertical-split'].includes(layoutType);
        }
        
        // Desktop: all layouts
        return true;
    }

    /**
     * Get recommended layout for viewport size
     * @param {number} viewportWidth - Viewport width
     * @param {number} sessionCount - Number of active sessions
     * @returns {string} Recommended layout type
     */
    getRecommendedLayout(viewportWidth, sessionCount) {
        if (viewportWidth <= 768 || sessionCount <= 1) {
            return 'tabs';
        }
        
        if (viewportWidth <= 1024) {
            return sessionCount >= 2 ? 'horizontal-split' : 'tabs';
        }
        
        // Desktop recommendations
        if (sessionCount <= 2) return 'horizontal-split';
        if (sessionCount === 3) return 'three-pane';
        if (sessionCount >= 4) return 'grid-2x2';
        
        return 'tabs';
    }

    /**
     * Move a tab from one pane to another
     * @param {string} layoutId - Layout ID
     * @param {string} sessionId - Session ID to move
     * @param {string} sourcePaneId - Source pane ID
     * @param {string} targetPaneId - Target pane ID
     * @param {number} targetIndex - Target index within pane (optional)
     * @returns {Object} Updated layout
     */
    async moveTabBetweenPanes(layoutId, sessionId, sourcePaneId, targetPaneId, targetIndex = -1) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            if (!config.panes) {
                throw new Error('Layout does not support panes');
            }

            const sourcePane = config.panes.find(p => p.id === sourcePaneId);
            const targetPane = config.panes.find(p => p.id === targetPaneId);
            
            if (!sourcePane || !targetPane) {
                throw new Error('Source or target pane not found');
            }

            // Find and remove tab from source pane
            const tabIndex = sourcePane.tabs.findIndex(tab => tab.sessionId === sessionId);
            if (tabIndex === -1) {
                throw new Error('Tab not found in source pane');
            }
            
            const [movedTab] = sourcePane.tabs.splice(tabIndex, 1);
            
            // If removing active tab from source pane, set new active tab
            if (sourcePane.activeTabId === sessionId && sourcePane.tabs.length > 0) {
                sourcePane.activeTabId = sourcePane.tabs[0].sessionId;
                sourcePane.tabs[0].isActive = true;
            } else if (sourcePane.tabs.length === 0) {
                sourcePane.activeTabId = null;
            }

            // Add tab to target pane
            movedTab.isActive = false; // Will be set as active below
            
            if (targetIndex >= 0 && targetIndex < targetPane.tabs.length) {
                targetPane.tabs.splice(targetIndex, 0, movedTab);
            } else {
                targetPane.tabs.push(movedTab);
            }

            // Set as active tab in target pane
            targetPane.tabs.forEach(tab => tab.isActive = false);
            movedTab.isActive = true;
            targetPane.activeTabId = sessionId;

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
            
            logger.info(`Moved tab ${sessionId} from ${sourcePaneId} to ${targetPaneId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error moving tab between panes:`, error);
            throw error;
        }
    }

    /**
     * Add a new tab to a specific pane
     * @param {string} layoutId - Layout ID
     * @param {string} paneId - Target pane ID
     * @param {string} sessionId - Session ID to add
     * @param {boolean} setActive - Whether to set as active tab
     * @returns {Object} Updated layout
     */
    async addTabToPane(layoutId, paneId, sessionId, setActive = true) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            if (!config.panes) {
                throw new Error('Layout does not support panes');
            }

            const targetPane = config.panes.find(p => p.id === paneId);
            if (!targetPane) {
                throw new Error('Target pane not found');
            }

            // Check if tab already exists
            if (targetPane.tabs.find(tab => tab.sessionId === sessionId)) {
                throw new Error('Tab already exists in this pane');
            }

            // Add new tab
            const newTab = { sessionId, isActive: setActive };
            targetPane.tabs.push(newTab);

            if (setActive) {
                // Deactivate other tabs in this pane
                targetPane.tabs.forEach(tab => {
                    if (tab.sessionId !== sessionId) {
                        tab.isActive = false;
                    }
                });
                targetPane.activeTabId = sessionId;
            }

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
            
            logger.info(`Added tab ${sessionId} to pane ${paneId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error adding tab to pane:`, error);
            throw error;
        }
    }

    /**
     * Remove a tab from a pane
     * @param {string} layoutId - Layout ID
     * @param {string} paneId - Pane ID
     * @param {string} sessionId - Session ID to remove
     * @returns {Object} Updated layout
     */
    async removeTabFromPane(layoutId, paneId, sessionId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            if (!config.panes) {
                throw new Error('Layout does not support panes');
            }

            const pane = config.panes.find(p => p.id === paneId);
            if (!pane) {
                throw new Error('Pane not found');
            }

            const tabIndex = pane.tabs.findIndex(tab => tab.sessionId === sessionId);
            if (tabIndex === -1) {
                throw new Error('Tab not found in pane');
            }

            pane.tabs.splice(tabIndex, 1);

            // If removing active tab, set new active tab
            if (pane.activeTabId === sessionId) {
                if (pane.tabs.length > 0) {
                    pane.activeTabId = pane.tabs[0].sessionId;
                    pane.tabs[0].isActive = true;
                } else {
                    pane.activeTabId = null;
                }
            }

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
            
            logger.info(`Removed tab ${sessionId} from pane ${paneId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error removing tab from pane:`, error);
            throw error;
        }
    }

    /**
     * Set active tab within a pane
     * @param {string} layoutId - Layout ID
     * @param {string} paneId - Pane ID
     * @param {string} sessionId - Session ID to make active
     * @returns {Object} Updated layout
     */
    async setActivePaneTab(layoutId, paneId, sessionId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);
            
            if (!config.panes) {
                throw new Error('Layout does not support panes');
            }

            const pane = config.panes.find(p => p.id === paneId);
            if (!pane) {
                throw new Error('Pane not found');
            }

            const tab = pane.tabs.find(tab => tab.sessionId === sessionId);
            if (!tab) {
                throw new Error('Tab not found in pane');
            }

            // Deactivate all tabs and activate the target
            pane.tabs.forEach(t => t.isActive = false);
            tab.isActive = true;
            pane.activeTabId = sessionId;

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);
            
            logger.debug(`Set active tab ${sessionId} in pane ${paneId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error setting active pane tab:`, error);
            throw error;
        }
    }

    /**
     * Clean up layouts for deleted workspaces
     * @param {string} workspaceId - Workspace ID
     */
    async cleanupWorkspaceLayouts(workspaceId) {
        try {
            await prisma.terminalLayout.deleteMany({
                where: { workspaceId }
            });
            
            logger.info(`Cleaned up layouts for workspace ${workspaceId}`);
        } catch (error) {
            logger.error(`Error cleaning up layouts for workspace ${workspaceId}:`, error);
            // Don't throw, this is cleanup
        }
    }
}

module.exports = new TerminalLayoutService();