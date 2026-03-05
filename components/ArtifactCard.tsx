/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Artifact } from '../types';
import { Maximize2, ExternalLink, Loader2 } from 'lucide-react';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused: boolean;
    onClick: () => void;
}

const ArtifactCard = React.memo(({ 
    artifact, 
    isFocused, 
    onClick 
}: ArtifactCardProps) => {
    const codeRef = useRef<HTMLPreElement>(null);

    // Auto-scroll logic for this specific card
    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
    }, [artifact.html]);

    const isBlurring = artifact.status === 'streaming' || artifact.status === 'pending';

    return (
        <motion.div 
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isBlurring ? 'generating' : ''}`}
            onClick={onClick}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
            <div className="artifact-header">
                <span className="artifact-style-tag">{artifact.styleName}</span>
                <span className="artifact-type-tag">{artifact.type.toUpperCase()}</span>
            </div>
            <div className="artifact-card-inner">
                {artifact.status === 'pending' && (
                    <div className="generating-overlay">
                        <div className="loading-spinner">
                            <Loader2 className="animate-spin" size={48} />
                            <p>Processing multimodal request...</p>
                        </div>
                    </div>
                )}
                {isBlurring && artifact.type === 'ui' && (
                    <div className="generating-overlay">
                        <pre ref={codeRef} className="code-stream-preview">
                            {artifact.html}
                        </pre>
                    </div>
                )}
                {artifact.type === 'ui' && artifact.html && (
                    <iframe 
                        srcDoc={artifact.html} 
                        title={artifact.id} 
                        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                        className="artifact-iframe"
                    />
                )}
                {artifact.type === 'image' && artifact.imageUrl && (
                    <img 
                        src={artifact.imageUrl} 
                        alt={artifact.styleName} 
                        className="artifact-image" 
                        referrerPolicy="no-referrer"
                    />
                )}
                {artifact.type === 'video' && artifact.videoUrl && (
                    <video 
                        src={artifact.videoUrl} 
                        controls 
                        className="artifact-video"
                    />
                )}
                {artifact.type === 'audio' && artifact.audioUrl && (
                    <div className="artifact-audio-container">
                        <audio 
                            src={artifact.audioUrl} 
                            controls 
                            className="artifact-audio"
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
});

export default ArtifactCard;
