import React from 'react';
import './MDFab.css';

interface MDFabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: string;
    variant?: 'primary' | 'secondary' | 'surface';
    size?: 'small' | 'medium' | 'large';
}

export const MDFab: React.FC<MDFabProps> = ({ icon, variant = 'primary', size = 'medium', className = '', ...props }) => {
    return (
        <button className={`md-fab md-fab--${variant} md-fab--${size} ${className}`} {...props}>
            <span className="material-symbols-rounded md-fab__icon">{icon}</span>
            <div className="md-fab__state-layer"></div>
        </button>
    );
};
