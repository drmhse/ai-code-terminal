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
                type: 'single',
                panes: [
                    {
                        id: 'pane-main',
                        position: 'main',
                        gridArea: '1 / 1 / 2 / 2',
                        tabs: [], // Now an array of session IDs
                        activeTabId: null,
                        status: 'pending'
                    }
                ]
            };

            const layout = await prisma.terminalLayout.create({
                data: {
                    workspaceId,
                    name: 'Default',
                    layoutType: 'single',
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
     * @param {string} layoutType - Layout type (single, horizontal-split, etc.)
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
    async addSessionToLayout(layoutId, sessionId, sessionName = 'New Terminal') {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);

            if (config.panes && config.panes.length > 0) {
                // Add the new session to the first pane's tab list
                if (!config.panes[0].tabs) {
                    config.panes[0].tabs = [];
                }
                config.panes[0].tabs.push(sessionId);
                config.panes[0].activeTabId = sessionId; // Make it active
                config.panes[0].status = 'active';
            }

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);

            logger.debug(`Added session "${sessionName}" to layout ${layoutId}`);
            return {
                layout: updatedLayout,
                sessionId: sessionId,
                configuration: config
            };
        } catch (error) {
            logger.error(`Error adding session to layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Remove a tab from a layout
     * @param {string} layoutId - Layout ID
     * @param {string} tabId - Tab ID to remove
     * @returns {Object} Updated configuration
     */
    async removeSessionFromLayout(layoutId, sessionId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);

            // Find and remove the session from panes
            if (config.panes) {
                for (const pane of config.panes) {
                    if (pane.tabs && pane.tabs.includes(sessionId)) {
                        pane.tabs = pane.tabs.filter(id => id !== sessionId);
                        if (pane.activeTabId === sessionId) {
                            pane.activeTabId = pane.tabs[0] || null;
                        }
                        if (pane.tabs.length === 0) {
                            pane.status = 'pending';
                        }
                    }
                }
            }

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);

            logger.debug(`Removed session ${sessionId} from layout ${layoutId}`);
            return {
                layout: updatedLayout,
                configuration: config
            };
        } catch (error) {
            logger.error(`Error removing session from layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Set active tab in a layout
     * @param {string} layoutId - Layout ID
     * @param {string} tabId - Tab ID to make active
     * @returns {Object} Updated configuration
     */
    async setActivePane(layoutId, paneId) {
        try {
            const layout = await prisma.terminalLayout.findUnique({
                where: { id: layoutId }
            });

            if (!layout) {
                throw new Error('Layout not found');
            }

            const config = JSON.parse(layout.configuration);

            const pane = config.panes?.find(p => p.id === paneId);
            if (!pane) {
                throw new Error('Pane not found');
            }

            logger.debug(`Focused pane ${paneId} in layout ${layoutId}`);
            return {
                layout: layout,
                configuration: config
            };
        } catch (error) {
            logger.error(`Error setting active pane in layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Set active tab within a specific pane
     * @param {string} layoutId - Layout ID
     * @param {string} paneId - Pane ID
     * @param {string} sessionId - Session ID to make active tab
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

            const pane = config.panes?.find(p => p.id === paneId);
            if (!pane) {
                throw new Error(`Pane ${paneId} not found`);
            }

            // Check if the session is in this pane's tabs
            if (!pane.tabs || !pane.tabs.includes(sessionId)) {
                throw new Error(`Session ${sessionId} not found in pane ${paneId}`);
            }

            // Set the active tab
            pane.activeTabId = sessionId;

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);

            logger.debug(`Set active tab ${sessionId} in pane ${paneId} for layout ${layoutId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error setting active tab in pane ${paneId} for layout ${layoutId}:`, error);
            throw error;
        }
    }

    /**
     * Create or update a split layout for a workspace
     * @param {string} workspaceId - Workspace ID
     * @param {string} layoutType - Split type (horizontal-split, vertical-split, etc.)
     * @param {Array} sessionIds - Array of session IDs to arrange in panes
     * @returns {Object} Updated layout
     */
    async createSplitLayout(workspaceId, layoutType, sessionIds = []) {
        try {
            const layout = await this.getDefaultLayout(workspaceId);

            // Create split configuration based on layout type and sessions
            const splitConfig = this.generateSplitConfiguration(layoutType, sessionIds);

            const updatedLayout = await prisma.terminalLayout.update({
                where: { id: layout.id },
                data: {
                    configuration: JSON.stringify(splitConfig),
                    layoutType: layoutType,
                    updatedAt: new Date()
                }
            });

            logger.info(`Created ${layoutType} layout for workspace ${workspaceId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error creating split layout for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Generate pane configuration based on layout type
     * @param {string} layoutType - Layout type
     * @param {Array} sessionIds - Session IDs to arrange
     * @returns {Object} Configuration object
     */
    generateSplitConfiguration(layoutType, sessionIds) {
        const baseConfig = {
            type: layoutType,
            panes: []
        };

        const paneCount = this.getRequiredPanesCount(layoutType);
        const paneTemplates = this.getPaneTemplates(layoutType);

        // Distribute session IDs among the new panes more evenly
        for (let i = 0; i < paneCount; i++) {
            const pane = { ...paneTemplates[i] };
            
            // Calculate sessions for this pane using round-robin distribution
            const paneSessions = [];
            for (let j = i; j < sessionIds.length; j += paneCount) {
                paneSessions.push(sessionIds[j]);
            }

            pane.tabs = paneSessions;
            pane.activeTabId = paneSessions[0] || null;
            pane.status = paneSessions.length > 0 ? 'active' : 'pending';

            baseConfig.panes.push(pane);
        }

        return baseConfig;
    }

    getPaneTemplates(layoutType) {
        switch (layoutType) {
            case 'horizontal-split': return [
                { id: 'pane-left', position: 'left', gridArea: '1 / 1 / 2 / 2' },
                { id: 'pane-right', position: 'right', gridArea: '1 / 2 / 2 / 3' }
            ];
            case 'vertical-split': return [
                { id: 'pane-top', position: 'top', gridArea: '1 / 1 / 2 / 2' },
                { id: 'pane-bottom', position: 'bottom', gridArea: '2 / 1 / 3 / 2' }
            ];
            case 'grid-2x2': return [
                { id: 'pane-tl', position: 'top-left', gridArea: '1 / 1 / 2 / 2' },
                { id: 'pane-tr', position: 'top-right', gridArea: '1 / 2 / 2 / 3' },
                { id: 'pane-bl', position: 'bottom-left', gridArea: '2 / 1 / 3 / 2' },
                { id: 'pane-br', position: 'bottom-right', gridArea: '2 / 2 / 3 / 3' }
            ];
            case 'three-pane': return [
                { id: 'pane-main', position: 'main', gridArea: '1 / 1 / 3 / 2' },
                { id: 'pane-top-right', position: 'top-right', gridArea: '1 / 2 / 2 / 3' },
                { id: 'pane-bottom-right', position: 'bottom-right', gridArea: '2 / 2 / 3 / 3' }
            ];
            default: return [
                { id: 'pane-main', position: 'main', gridArea: '1 / 1 / 2 / 2' }
            ];
        }
    }


    /**
     * Convert current layout to split panes
     * @param {string} workspaceId - Workspace ID
     * @param {string} targetLayoutType - Target layout type
     * @returns {Object} Updated layout
     */
    async convertToSplit(workspaceId, targetLayoutType, allSessionIds = []) {
        try {
            return await this.createSplitLayout(workspaceId, targetLayoutType, allSessionIds);
        } catch (error) {
            logger.error(`Error converting layout to split for workspace ${workspaceId}:`, error);
            throw error;
        }
    }

    /**
     * Convert multi-pane layout back to single pane, consolidating all sessions
     * @param {string} workspaceId - Workspace ID
     * @param {Array} allSessionIds - All currently active session IDs
     * @returns {Object} Updated layout
     */
    async convertToSingle(workspaceId, allSessionIds = []) {
        try {
            const layout = await this.getDefaultLayout(workspaceId);
            const singleConfig = {
                type: 'single',
                panes: [{
                    id: 'pane-single',
                    position: 'main',
                    gridArea: '1 / 1 / 2 / 2',
                    tabs: allSessionIds,
                    activeTabId: allSessionIds[0] || null,
                    status: allSessionIds.length > 0 ? 'active' : 'pending'
                }]
            };

            const updatedLayout = await prisma.terminalLayout.update({
                where: { id: layout.id },
                data: {
                    configuration: JSON.stringify(singleConfig),
                    layoutType: 'single',
                    updatedAt: new Date()
                }
            });

            logger.info(`Converted layout to single pane for workspace ${workspaceId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error converting to single pane for workspace ${workspaceId}:`, error);
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
                    if(!pane.tabs) pane.tabs = [];
                    pane.tabs.push(sessionId);
                    pane.activeTabId = sessionId;
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
            case 'single':
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
        // Mobile: only single pane
        if (viewportWidth <= 768) {
            return layoutType === 'single';
        }

        // Tablet: simple layouts only
        if (viewportWidth <= 1024) {
            return ['single', 'horizontal-split', 'vertical-split'].includes(layoutType);
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
            return 'single';
        }

        if (viewportWidth <= 1024) {
            return sessionCount >= 2 ? 'horizontal-split' : 'single';
        }

        // Desktop recommendations
        if (sessionCount <= 1) return 'single';
        if (sessionCount === 2) return 'horizontal-split';
        if (sessionCount === 3) return 'three-pane';
        if (sessionCount >= 4) return 'grid-2x2';

        return 'single';
    }

    /**
     * Move a session from one pane to another
     * @param {string} layoutId - Layout ID
     * @param {string} sessionId - Session ID to move
     * @param {string} sourcePaneId - Source pane ID
     * @param {string} targetPaneId - Target pane ID
     * @returns {Object} Updated layout
     */
    async moveSessionBetweenPanes(layoutId, sessionId, sourcePaneId, targetPaneId) {
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

            // Move session from source to target
            if (sourcePane.tabs && sourcePane.tabs.includes(sessionId)) {
                sourcePane.tabs = sourcePane.tabs.filter(id => id !== sessionId);
                if (sourcePane.activeTabId === sessionId) {
                    sourcePane.activeTabId = sourcePane.tabs[0] || null;
                }
            }

            if (!targetPane.tabs) targetPane.tabs = [];
            targetPane.tabs.push(sessionId);
            targetPane.activeTabId = sessionId;

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);

            logger.info(`Moved session ${sessionId} from ${sourcePaneId} to ${targetPaneId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error moving session between panes:`, error);
            throw error;
        }
    }

    /**
     * Move a tab between panes with optional target index
     * @param {string} layoutId - Layout ID
     * @param {string} sessionId - Session ID to move
     * @param {string} sourcePaneId - Source pane ID
     * @param {string} targetPaneId - Target pane ID
     * @param {number} targetIndex - Target index in the pane (optional)
     * @returns {Object} Updated layout
     */
    async moveTabBetweenPanes(layoutId, sessionId, sourcePaneId, targetPaneId, targetIndex) {
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

            // Remove session from source pane
            if (sourcePane.tabs && sourcePane.tabs.includes(sessionId)) {
                sourcePane.tabs = sourcePane.tabs.filter(id => id !== sessionId);
                if (sourcePane.activeTabId === sessionId) {
                    sourcePane.activeTabId = sourcePane.tabs[0] || null;
                }
                if (sourcePane.tabs.length === 0) {
                    sourcePane.status = 'pending';
                }
            }

            // Add session to target pane
            if (!targetPane.tabs) targetPane.tabs = [];
            
            if (targetIndex !== undefined && targetIndex >= 0) {
                // Insert at specific index
                targetPane.tabs.splice(targetIndex, 0, sessionId);
            } else {
                // Add to end
                targetPane.tabs.push(sessionId);
            }
            
            targetPane.activeTabId = sessionId;
            targetPane.status = 'active';

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);

            logger.info(`Moved tab ${sessionId} from ${sourcePaneId} to ${targetPaneId}${targetIndex !== undefined ? ` at index ${targetIndex}` : ''}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error moving tab between panes:`, error);
            throw error;
        }
    }

    /**
     * Add a tab to a specific pane
     * @param {string} layoutId - Layout ID
     * @param {string} paneId - Pane ID
     * @param {string} sessionId - Session ID to add
     * @param {boolean} setAsActive - Whether to set as active tab
     * @returns {Object} Updated layout
     */
    async addTabToPane(layoutId, paneId, sessionId, setAsActive = false) {
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
                throw new Error(`Pane ${paneId} not found`);
            }

            if (!pane.tabs) pane.tabs = [];
            
            // Don't add if already exists
            if (pane.tabs.includes(sessionId)) {
                if (setAsActive) {
                    pane.activeTabId = sessionId;
                }
            } else {
                pane.tabs.push(sessionId);
                if (setAsActive) {
                    pane.activeTabId = sessionId;
                }
            }

            pane.status = 'active';

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);

            logger.debug(`Added tab ${sessionId} to pane ${paneId}${setAsActive ? ' as active' : ''}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error adding tab to pane ${paneId}:`, error);
            throw error;
        }
    }

    /**
     * Remove a tab from a specific pane
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
                throw new Error(`Pane ${paneId} not found`);
            }

            if (pane.tabs && pane.tabs.includes(sessionId)) {
                pane.tabs = pane.tabs.filter(id => id !== sessionId);
                
                // If this was the active tab, switch to the first remaining tab
                if (pane.activeTabId === sessionId) {
                    pane.activeTabId = pane.tabs[0] || null;
                }
                
                // Update pane status
                if (pane.tabs.length === 0) {
                    pane.status = 'pending';
                }
            }

            const updatedLayout = await this.updateLayoutConfiguration(layoutId, config);

            logger.debug(`Removed tab ${sessionId} from pane ${paneId}`);
            return updatedLayout;
        } catch (error) {
            logger.error(`Error removing tab from pane ${paneId}:`, error);
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
