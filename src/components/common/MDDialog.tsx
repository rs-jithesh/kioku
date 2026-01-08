import React from 'react';
import './MDDialog.css';
import { MDButton } from './MDButton';

interface MDDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    icon?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    variant?: 'alert' | 'confirm';
}

export const MDDialog: React.FC<MDDialogProps> = ({ 
    isOpen, 
    onClose, 
    title, 
    message, 
    icon,
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm,
    variant = 'alert'
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose();
    };

    return (
        <div className="md-dialog-overlay" onClick={variant === 'alert' ? onClose : undefined}>
            <div className="md-dialog-container" onClick={e => e.stopPropagation()}>
                {icon && <span className="material-symbols-rounded md-dialog-icon">{icon}</span>}
                <h3 className="md-dialog-title">{title}</h3>
                <p className="md-dialog-message">{message}</p>
                <div className={`md-dialog-actions ${variant === 'confirm' ? 'md-dialog-actions--confirm' : ''}`}>
                    {variant === 'confirm' && (
                        <>
                            <MDButton variant="text" onClick={onClose}>{cancelText}</MDButton>
                            <MDButton variant="filled" onClick={handleConfirm}>{confirmText}</MDButton>
                        </>
                    )}
                    {variant === 'alert' && (
                        <MDButton variant="text" onClick={onClose}>{confirmText}</MDButton>
                    )}
                </div>
            </div>
        </div>
    );
};
