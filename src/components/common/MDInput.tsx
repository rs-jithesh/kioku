import React from 'react';
import './MDInput.css';

interface MDInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export const MDInput = React.forwardRef<HTMLInputElement, MDInputProps>(({ label, className = '', ...props }, ref) => {
    return (
        <div className={`md-input-container ${className}`}>
            <input ref={ref} className="md-input-field" placeholder=" " {...props} />
            <label className="md-input-label">{label}</label>
        </div>
    );
});
