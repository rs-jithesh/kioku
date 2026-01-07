import React from 'react';
import './MDDialog.css';
import { MDButton } from './MDButton';

interface MDDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    icon?: string;
}

export const MDDialog: React.FC<MDDialogProps> = ({ isOpen, onClose, title, message, icon }) => {
    if (!isOpen) return null;

    return (
        <div className="md-dialog-overlay" onClick={onClose}>
            <div className="md-dialog-container" onClick={e => e.stopPropagation()}>
                {icon && <span className="material-symbols-rounded md-dialog-icon">{icon}</span>}
                <h3 className="md-dialog-title">{title}</h3>
                <p className="md-dialog-message">{message}</p>
                <div className="md-dialog-actions">
                    <MDButton variant="text" onClick={onClose}>OK</MDButton>
                </div>
            </div>
        </div>
    );
};
