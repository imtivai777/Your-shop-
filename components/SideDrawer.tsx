/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children?: React.ReactNode;
}

const SideDrawer = ({ isOpen, onClose, title, children }: SideDrawerProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    className="drawer-overlay" 
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div 
                        className="drawer-content" 
                        onClick={(e) => e.stopPropagation()}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <div className="drawer-header">
                            <h2>{title}</h2>
                            <button onClick={onClose} className="close-button">&times;</button>
                        </div>
                        <div className="drawer-body">
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SideDrawer;