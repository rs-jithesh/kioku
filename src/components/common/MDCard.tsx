import React from 'react';
import './MDCard.css';

interface MDCardProps {
    children: React.ReactNode;
    variant?: 'elevated' | 'filled' | 'outlined';
    className?: string;
    onClick?: () => void;
}

export const MDCard: React.FC<MDCardProps> = ({ variant = 'elevated', children, className = '', onClick }) => {
    return (
        <div className={`md-card md-card--${variant} ${className}`} onClick={onClick}>
            {children}
        </div>
    );
};
