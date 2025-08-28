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