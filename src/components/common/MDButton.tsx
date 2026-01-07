import React from 'react';
import './MDButton.css';

interface MDButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'filled' | 'outlined' | 'text' | 'tonal';
    icon?: string; // Material Symbol name
}

export const MDButton: React.FC<MDButtonProps> = ({ variant = 'filled', icon, children, className = '', ...props }) => {
    return (
        <button className={`md-button md-button--${variant} ${className}`} {...props}>
            {/* Ripple effect can be added with CSS or a library, keeping it simple CSS for now */}
            <div className="md-button__state-layer"></div>
            {icon && <span className="material-symbols-rounded md-button__icon">{icon}</span>}
            <span className="md-button__label">{children}</span>
        </button>
    );
};
