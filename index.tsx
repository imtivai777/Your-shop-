/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com

import { GoogleGenAI, Modality } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Sparkles, 
    Code, 
    LayoutGrid, 
    ArrowLeft, 
    ArrowRight, 
    ArrowUp, 
    Loader2,
    Zap,
    Image as ImageIcon,
    Video as VideoIcon,
    Mic,
    Volume2,
    Search,
    MapPin,
    Edit3,
    Settings
} from 'lucide-react';

import { Artifact, Session, ComponentVariation } from './types';
import { INITIAL_PLACEHOLDERS } from './components/constants';
import { generateId } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';

// Extend Window interface for AI Studio API
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | 'settings' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);
  const [multimodalConfig, setMultimodalConfig] = useState({
    useSearch: false,
    useMaps: false,
    useTTS: false,
    imageSize: '1K' as '1K' | '2K' | '4K',
    fastMode: false
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      inputRef.current?.focus();
  }, []);

  // Fix for mobile: reset scroll when focusing an item to prevent "overscroll" state
  useEffect(() => {
    if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }
  }, [focusedArtifactIndex]);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  // Dynamic placeholder generation on load
  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const apiKey = process.env.GEMINI_API_KEY;
              if (!apiKey) return;
              const ai = new GoogleGenAI({ apiKey });
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: { 
                      role: 'user', 
                      parts: [{ 
                          text: 'Generate 20 creative, short, diverse UI component prompts (e.g. "bioluminescent task list"). Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.' 
                      }] 
                  }
              });
              const text = response.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                      setPlaceholders(prev => [...prev, ...shuffled]);
                  }
              }
          } catch (e) {
              console.warn("Silently failed to fetch dynamic placeholders", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1000);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const parseJsonStream = async function* (responseStream: AsyncGenerator<{ text: string }>) {
      let buffer = '';
      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text !== 'string') continue;
          buffer += text;
          let braceCount = 0;
          let start = buffer.indexOf('{');
          while (start !== -1) {
              braceCount = 0;
              let end = -1;
              for (let i = start; i < buffer.length; i++) {
                  if (buffer[i] === '{') braceCount++;
                  else if (buffer[i] === '}') braceCount--;
                  if (braceCount === 0 && i > start) {
                      end = i;
                      break;
                  }
              }
              if (end !== -1) {
                  const jsonString = buffer.substring(start, end + 1);
                  try {
                      yield JSON.parse(jsonString);
                      buffer = buffer.substring(end + 1);
                      start = buffer.indexOf('{');
                  } catch (e) {
                      start = buffer.indexOf('{', start + 1);
                  }
              } else {
                  break; 
              }
          }
      }
  };

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
You are a master UI/UX designer. Generate 3 RADICAL CONCEPTUAL VARIATIONS of: "${currentSession.prompt}".

**STRICT IP SAFEGUARD:**
No names of artists. 
Instead, describe the *Physicality* and *Material Logic* of the UI.

**CREATIVE GUIDANCE (Use these as EXAMPLES of how to describe style, but INVENT YOUR OWN):**
1. Example: "Asymmetrical Primary Grid" (Heavy black strokes, rectilinear structure, flat primary pigments, high-contrast white space).
2. Example: "Suspended Kinetic Mobile" (Delicate wire-thin connections, floating organic primary shapes, slow-motion balance, white-void background).
3. Example: "Grainy Risograph Press" (Overprinted translucent inks, dithered grain textures, monochromatic color depth, raw paper substrate).
4. Example: "Volumetric Spectral Fluid" (Generative morphing gradients, soft-focus diffusion, bioluminescent light sources, spectral chromatic aberration).

**YOUR TASK:**
For EACH variation:
- Invent a unique design persona name based on a NEW physical metaphor.
- Rewrite the prompt to fully adopt that metaphor's visual language.
- Generate high-fidelity HTML/CSS.

Required JSON Output Format (stream ONE object per line):
\`{ "name": "Persona Name", "html": "..." }\`
        `.trim();

        const responseStream = await ai.models.generateContentStream({
            model: multimodalConfig.fastMode ? 'gemini-2.5-flash-lite' : 'gemini-3.1-pro-preview',
             contents: [{ parts: [{ text: prompt }], role: 'user' }],
             config: { temperature: 1.2 }
        });

        for await (const variation of parseJsonStream(responseStream)) {
            if (variation.name && variation.html) {
                setComponentVariations(prev => [...prev, variation]);
            }
        }
    } catch (e: any) {
        console.error("Error generating variations:", e);
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, multimodalConfig.fastMode]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      setSessions(prev => prev.map((sess, i) => 
          i === currentSessionIndex ? {
              ...sess,
              artifacts: sess.artifacts.map((art, j) => 
                j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
              )
          } : sess
      ));
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleShowCode = () => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
      }
  };

  const checkApiKey = async () => {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
    }
    return true;
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Designing...',
        html: '',
        type: 'ui',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: baseTime,
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
        const ai = new GoogleGenAI({ apiKey });

        // Grounding tools
        const tools: any[] = [];
        if (multimodalConfig.useSearch) tools.push({ googleSearch: {} });
        if (multimodalConfig.useMaps) tools.push({ googleMaps: {} });

        const stylePrompt = `
Generate 3 distinct, highly evocative design directions for: "${trimmedInput}".

**STRICT IP SAFEGUARD:**
Never use artist or brand names. Use physical and material metaphors.

**CREATIVE EXAMPLES (Do not simply copy these, use them as a guide for tone):**
- Example A: "Asymmetrical Rectilinear Blockwork" (Grid-heavy, primary pigments, thick structural strokes, Bauhaus-functionalism vibe).
- Example B: "Grainy Risograph Layering" (Tactile paper texture, overprinted translucent inks, dithered gradients).
- Example C: "Kinetic Wireframe Suspension" (Floating silhouettes, thin balancing lines, organic primary shapes).
- Example D: "Spectral Prismatic Diffusion" (Glassmorphism, caustic refraction, soft-focus morphing gradients).

**GOAL:**
Return ONLY a raw JSON array of 3 *NEW*, creative names for these directions (e.g. ["Tactile Risograph Press", "Kinetic Silhouette Balance", "Primary Pigment Gridwork"]).
        `.trim();

        const styleResponse = await ai.models.generateContent({
            model: multimodalConfig.fastMode ? 'gemini-2.5-flash-lite' : 'gemini-3-flash-preview',
            contents: { role: 'user', parts: [{ text: stylePrompt }] },
            config: { tools }
        });

        let generatedStyles: string[] = [];
        const styleText = styleResponse.text || '[]';
        const jsonMatch = styleText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            try {
                generatedStyles = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("Failed to parse styles, using fallbacks");
            }
        }

        if (!generatedStyles || generatedStyles.length < 3) {
            generatedStyles = [
                "Primary Pigment Gridwork",
                "Tactile Risograph Layering",
                "Kinetic Silhouette Balance"
            ];
        }
        
        generatedStyles = generatedStyles.slice(0, 3);

        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
                ...s,
                artifacts: s.artifacts.map((art, i) => ({
                    ...art,
                    styleName: generatedStyles[i]
                }))
            };
        }));

        const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
            try {
                const prompt = `
You are Flash UI. Create a stunning, high-fidelity UI component for: "${trimmedInput}".

**CONCEPTUAL DIRECTION: ${styleInstruction}**

**VISUAL EXECUTION RULES:**
1. **Materiality**: Use the specified metaphor to drive every CSS choice. (e.g. if Risograph, use \`feTurbulence\` for grain and \`mix-blend-mode: multiply\` for ink layering).
2. **Typography**: Use high-quality web fonts. Pair a bold sans-serif with a refined monospace for data.
3. **Motion**: Include subtle, high-performance CSS/JS animations (hover transitions, entry reveals).
4. **IP SAFEGUARD**: No artist names or trademarks. 
5. **Layout**: Be bold with negative space and hierarchy. Avoid generic cards.

Return ONLY RAW HTML. No markdown fences.
          `.trim();
          
                const responseStream = await ai.models.generateContentStream({
                    model: multimodalConfig.fastMode ? 'gemini-2.5-flash-lite' : 'gemini-3.1-pro-preview',
                    contents: [{ parts: [{ text: prompt }], role: "user" }],
                    config: { tools }
                });

                let accumulatedHtml = '';
                for await (const chunk of responseStream) {
                    const text = chunk.text;
                    if (typeof text === 'string') {
                        accumulatedHtml += text;
                        setSessions(prev => prev.map(sess => 
                            sess.id === sessionId ? {
                                ...sess,
                                artifacts: sess.artifacts.map(art => 
                                    art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                                )
                            } : sess
                        ));
                    }
                }
                
                let finalHtml = accumulatedHtml.trim();
                if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                        )
                    } : sess
                ));

                // TTS if enabled
                if (multimodalConfig.useTTS) {
                    const ttsResponse = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-preview-tts',
                        contents: [{ parts: [{ text: `Generated a ${styleInstruction} UI for ${trimmedInput}` }] }],
                        config: {
                            responseModalities: [Modality.AUDIO],
                            speechConfig: {
                                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                            }
                        }
                    });
                    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                    if (base64Audio) {
                        const audioUrl = `data:audio/wav;base64,${base64Audio}`;
                         setSessions(prev => prev.map(sess => 
                            sess.id === sessionId ? {
                                ...sess,
                                artifacts: sess.artifacts.map(art => 
                                    art.id === artifact.id ? { ...art, audioUrl } : art
                                )
                            } : sess
                        ));
                    }
                }

            } catch (e: any) {
                console.error('Error generating artifact:', e);
                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e.message}</div>`, status: 'error' } : art
                        )
                    } : sess
                ));
            }
        };

        await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));

    } catch (e) {
        console.error("Fatal error in generation process", e);
    } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, sessions.length, multimodalConfig]);

  const handleGenerateImage = async () => {
    if (!inputValue.trim() || isLoading) return;
    setIsLoading(true);
    await checkApiKey();
    
    const sessionId = generateId();
    const artifactId = `${sessionId}_img`;
    
    const newSession: Session = {
        id: sessionId,
        prompt: inputValue,
        timestamp: Date.now(),
        artifacts: [{
            id: artifactId,
            styleName: 'Generating Image...',
            type: 'image',
            status: 'pending'
        }]
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);
    setInputValue('');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: inputValue }] },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: multimodalConfig.imageSize
                }
            } as any
        });

        let imageUrl = '';
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                break;
            }
        }

        setSessions(prev => prev.map(s => 
            s.id === sessionId ? {
                ...s,
                artifacts: s.artifacts.map(art => 
                    art.id === artifactId ? { ...art, imageUrl, status: 'complete' } : art
                )
            } : s
        ));
    } catch (e) {
        console.error("Image generation failed", e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleEditImage = async (file: File) => {
    if (!inputValue.trim() || isLoading) return;
    setIsLoading(true);
    
    const reader = new FileReader();
    reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const sessionId = generateId();
        const artifactId = `${sessionId}_edit`;
        
        const newSession: Session = {
            id: sessionId,
            prompt: `Edit: ${inputValue}`,
            timestamp: Date.now(),
            artifacts: [{
                id: artifactId,
                styleName: 'Editing Image...',
                type: 'image',
                status: 'pending'
            }]
        };

        setSessions(prev => [...prev, newSession]);
        setCurrentSessionIndex(sessions.length);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType: file.type } },
                        { text: inputValue }
                    ]
                }
            });

            let imageUrl = '';
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                    break;
                }
            }

            setSessions(prev => prev.map(s => 
                s.id === sessionId ? {
                    ...s,
                    artifacts: s.artifacts.map(art => 
                        art.id === artifactId ? { ...art, imageUrl, status: 'complete' } : art
                    )
                } : s
            ));
        } catch (e) {
            console.error("Image editing failed", e);
        } finally {
            setIsLoading(false);
            setInputValue('');
        }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateVideo = async (file: File) => {
    setIsLoading(true);
    await checkApiKey();

    const reader = new FileReader();
    reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const sessionId = generateId();
        const artifactId = `${sessionId}_video`;
        
        const newSession: Session = {
            id: sessionId,
            prompt: 'Animate with Veo',
            timestamp: Date.now(),
            artifacts: [{
                id: artifactId,
                styleName: 'Generating Video...',
                type: 'video',
                status: 'pending'
            }]
        };

        setSessions(prev => [...prev, newSession]);
        setCurrentSessionIndex(sessions.length);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: inputValue || 'Animate this photo',
                image: {
                    imageBytes: base64Data,
                    mimeType: file.type,
                },
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '16:9'
                }
            });

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                operation = await (ai.operations as any).getVideosOperation({operation: operation});
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const videoResponse = await fetch(downloadLink, {
                    method: 'GET',
                    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
                });
                const videoBlob = await videoResponse.blob();
                const videoUrl = URL.createObjectURL(videoBlob);

                setSessions(prev => prev.map(s => 
                    s.id === sessionId ? {
                        ...s,
                        artifacts: s.artifacts.map(art => 
                            art.id === artifactId ? { ...art, videoUrl, status: 'complete' } : art
                        )
                    } : s
                ));
            }
        } catch (e) {
            console.error("Video generation failed", e);
        } finally {
            setIsLoading(false);
            setInputValue('');
        }
    };
    reader.readAsDataURL(file);
  };

  const startLiveSession = async () => {
    await checkApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const sessionId = generateId();
    const artifactId = `${sessionId}_live`;
    
    const newSession: Session = {
        id: sessionId,
        prompt: 'Live Voice Session',
        timestamp: Date.now(),
        artifacts: [{
            id: artifactId,
            styleName: 'Live Conversation',
            type: 'audio',
            status: 'streaming'
        }]
    };
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);

    const sessionPromise = ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      callbacks: {
        onopen: () => {
          console.log("Live session opened");
        },
        onmessage: async (message) => {
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
             const audioUrl = `data:audio/pcm;rate=16000;base64,${base64Audio}`;
             // In a real app, we'd stream this to an AudioContext
             console.log("Received audio chunk");
          }
        },
        onclose: () => console.log("Live session closed")
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: { parts: [{ text: "You are a helpful UI design assistant. Talk to the user about their design ideas." }] },
      },
    });
  };

  const handleSurpriseMe = () => {
      const currentPrompt = placeholders[placeholderIndex];
      setInputValue(currentPrompt);
      handleSendMessage(currentPrompt);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      handleSendMessage();
    } else if (event.key === 'Tab' && !inputValue && !isLoading) {
        event.preventDefault();
        setInputValue(placeholders[placeholderIndex]);
    }
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
      } else {
          if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
      }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
      } else {
           if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
      }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const isLoadingDrawer = isLoading && drawerState.mode === 'variations' && componentVariations.length === 0;

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  let canGoBack = false;
  let canGoForward = false;

  if (hasStarted) {
      if (focusedArtifactIndex !== null) {
          canGoBack = focusedArtifactIndex > 0;
          canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
      } else {
          canGoBack = currentSessionIndex > 0;
          canGoForward = currentSessionIndex < sessions.length - 1;
      }
  }

  return (
    <>
        <a href="https://x.com/ammaar" target="_blank" rel="noreferrer" className={`creator-credit ${hasStarted ? 'hide-on-mobile' : ''}`}>
            created by @ammaar
        </a>

        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
        >
            {isLoadingDrawer && (
                 <div className="loading-state">
                     <Loader2 className="animate-spin" /> 
                     Designing variations...
                 </div>
            )}

            {drawerState.mode === 'code' && (
                <pre className="code-block"><code>{drawerState.data}</code></pre>
            )}
            
            {drawerState.mode === 'variations' && (
                <div className="sexy-grid">
                    {componentVariations.map((v, i) => (
                         <motion.div 
                            key={i} 
                            className="sexy-card" 
                            onClick={() => applyVariation(v.html)}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                         >
                             <div className="sexy-preview">
                                 <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                             </div>
                             <div className="sexy-label">{v.name}</div>
                         </motion.div>
                    ))}
                </div>
            )}

            {drawerState.mode === 'settings' && (
                <div className="settings-panel">
                    <div className="setting-item">
                        <label>Image Size</label>
                        <select 
                            value={multimodalConfig.imageSize} 
                            onChange={(e) => setMultimodalConfig(prev => ({ ...prev, imageSize: e.target.value as any }))}
                        >
                            <option value="1K">1K</option>
                            <option value="2K">2K</option>
                            <option value="4K">4K</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <label>Fast Mode (Flash Lite)</label>
                        <input 
                            type="checkbox" 
                            checked={multimodalConfig.fastMode} 
                            onChange={(e) => setMultimodalConfig(prev => ({ ...prev, fastMode: e.target.checked }))}
                        />
                    </div>
                </div>
            )}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={24} 
                radius={1.5} 
                color="rgba(255, 255, 255, 0.02)" 
                glowColor="rgba(255, 255, 255, 0.15)" 
                speedScale={0.5} 
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                <AnimatePresence>
                    {!hasStarted && (
                        <motion.div 
                            className="empty-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="empty-content">
                                <motion.h1
                                    initial={{ opacity: 0, y: 40, filter: 'blur(20px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
                                    transition={{ delay: 0.2, duration: 1.2 }}
                                >
                                    Flash UI
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0, y: 40, filter: 'blur(20px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
                                    transition={{ delay: 0.5, duration: 1.2 }}
                                >
                                    Creative UI generation in a flash
                                </motion.p>
                                <motion.button 
                                    className="surprise-button" 
                                    onClick={handleSurpriseMe} 
                                    disabled={isLoading}
                                    initial={{ opacity: 0, y: 40, filter: 'blur(20px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
                                    transition={{ delay: 0.8, duration: 1.2 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Sparkles size={18} /> Surprise Me
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {sessions.map((session, sIndex) => {
                    let positionClass = 'hidden';
                    if (sIndex === currentSessionIndex) positionClass = 'active-session';
                    else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                    else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                    
                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                {session.artifacts.map((artifact, aIndex) => {
                                    const isFocused = focusedArtifactIndex === aIndex;
                                    
                                    return (
                                        <ArtifactCard 
                                            key={artifact.id}
                                            artifact={artifact}
                                            isFocused={isFocused}
                                            onClick={() => setFocusedArtifactIndex(aIndex)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

             {canGoBack && (
                <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                    <ArrowLeft />
                </button>
             )}
             {canGoForward && (
                <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                    <ArrowRight />
                </button>
             )}

            <motion.div 
                className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}
                initial={false}
                animate={{ 
                    opacity: focusedArtifactIndex !== null ? 1 : 0,
                    y: focusedArtifactIndex !== null ? 0 : 20,
                    pointerEvents: focusedArtifactIndex !== null ? 'auto' : 'none'
                }}
            >
                 <div className="active-prompt-label">
                    {currentSession?.prompt}
                 </div>
                 <div className="action-buttons">
                    <button onClick={() => setFocusedArtifactIndex(null)}>
                        <LayoutGrid size={16} /> Grid View
                    </button>
                    <button onClick={handleGenerateVariations} disabled={isLoading}>
                        <Sparkles size={16} /> Variations
                    </button>
                    <button onClick={handleShowCode}>
                        <Code size={16} /> Source
                    </button>
                 </div>
            </motion.div>

            <div className="floating-input-container">
                <div className="multimodal-toolbar">
                    <button 
                        className={multimodalConfig.useSearch ? 'active' : ''} 
                        onClick={() => setMultimodalConfig(prev => ({ ...prev, useSearch: !prev.useSearch }))}
                        title="Google Search Grounding"
                    >
                        <Search size={16} />
                    </button>
                    <button 
                        className={multimodalConfig.useMaps ? 'active' : ''} 
                        onClick={() => setMultimodalConfig(prev => ({ ...prev, useMaps: !prev.useMaps }))}
                        title="Google Maps Grounding"
                    >
                        <MapPin size={16} />
                    </button>
                    <button 
                        className={multimodalConfig.useTTS ? 'active' : ''} 
                        onClick={() => setMultimodalConfig(prev => ({ ...prev, useTTS: !prev.useTTS }))}
                        title="Text-to-Speech"
                    >
                        <Volume2 size={16} />
                    </button>
                    <button onClick={handleGenerateImage} title="Generate Image">
                        <ImageIcon size={16} />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} title="Upload Photo for Veo/Edit">
                        <VideoIcon size={16} />
                    </button>
                    <button onClick={startLiveSession} title="Live Voice Session">
                        <Mic size={16} />
                    </button>
                    <button onClick={() => setDrawerState({ isOpen: true, mode: 'settings', title: 'Multimodal Settings', data: null })} title="Settings">
                        <Settings size={16} />
                    </button>
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            if (inputValue.toLowerCase().includes('edit')) {
                                handleEditImage(file);
                            } else {
                                handleGenerateVideo(file);
                            }
                        }
                    }}
                />

                <motion.div 
                    className={`input-wrapper ${isLoading ? 'loading' : ''}`}
                    layout
                >
                    <AnimatePresence mode="wait">
                        {(!inputValue && !isLoading) && (
                            <motion.div 
                                className="animated-placeholder" 
                                key={placeholderIndex}
                                initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                                animate={{ opacity: 0.7, y: 0, filter: 'blur(0)' }}
                                exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
                                transition={{ duration: 0.4 }}
                            >
                                <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                                <span className="tab-hint">Tab</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    {!isLoading ? (
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={inputValue} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown} 
                            disabled={isLoading} 
                        />
                    ) : (
                        <div className="input-generating-label">
                            <span className="generating-prompt-text">{currentSession?.prompt}</span>
                            <Zap className="animate-pulse text-yellow-400" size={18} />
                        </div>
                    )}
                    <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
                        <ArrowUp size={20} />
                    </button>
                </motion.div>
            </div>
        </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
