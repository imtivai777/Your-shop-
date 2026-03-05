/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Artifact {
  id: string;
  styleName: string;
  html?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  type: 'ui' | 'image' | 'video' | 'audio';
  status: 'streaming' | 'complete' | 'error' | 'pending';
}

export interface Session {
    id: string;
    prompt: string;
    timestamp: number;
    artifacts: Artifact[];
}

export interface ComponentVariation { name: string; html: string; }
export interface LayoutOption { name: string; css: string; previewHtml: string; }