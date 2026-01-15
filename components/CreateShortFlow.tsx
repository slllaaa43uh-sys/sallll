
import React, { useState } from 'react';
import CreateVideoView from './CreateVideoView';
import EditVideoView, { TextOverlay, StickerOverlay } from './EditVideoView';
import PublishVideoView from './PublishVideoView';
import { API_BASE_URL } from '../constants';

interface CreateShortFlowProps {
  onClose: () => void;
  onPostSubmit: (payload: any) => Promise<void>;
}

const CreateShortFlow: React.FC<CreateShortFlowProps> = ({ onClose, onPostSubmit }) => {
  const [step, setStep] = useState<'record' | 'edit' | 'publish'>('record');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  
  // State for Overlays
  const [overlayTexts, setOverlayTexts] = useState<TextOverlay[]>([]);
  const [overlayStickers, setOverlayStickers] = useState<StickerOverlay[]>([]);
  const [voiceoverBlob, setVoiceoverBlob] = useState<Blob | null>(null);
  const [audioSettings, setAudioSettings] = useState<{ isMuted: boolean }>({ isMuted: false });
  
  // Store the selected filter CSS string here to persist across views
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVideoReady = (file: File) => {
    setVideoFile(file);
    setVideoSrc(URL.createObjectURL(file));
    setStep('edit');
  };

  const handleBackToRecord = () => {
    setVideoFile(null);
    setVideoSrc(null);
    setSelectedFilter('none'); // Reset filter
    setOverlayTexts([]);
    setOverlayStickers([]);
    setVoiceoverBlob(null);
    setAudioSettings({ isMuted: false });
    setStep('record');
  };

  const handleProceedToPublish = (texts: TextOverlay[], stickers: StickerOverlay[], voiceover: Blob | null, settings: { isMuted: boolean }) => {
    setOverlayTexts(texts); 
    setOverlayStickers(stickers);
    if (voiceover) setVoiceoverBlob(voiceover);
    setAudioSettings(settings);
    setStep('publish');
  };

  const handleBackToEdit = () => {
    setStep('edit');
  };

  // Upload Logic Moved to App.tsx via onPostSubmit raw payload
  
  const handlePublish = async (details: { 
      title: string; 
      description: string; 
      category: string; 
      allowComments: boolean; 
      allowDownload: boolean; 
      allowDuet: boolean; 
      privacy: string; 
      coverFile: File | null;
      promotion?: any;
      hashtags?: string[];
      mentions?: { username: string }[];
      websiteLink?: string;
      location?: string;
  }) => {
    if (!videoFile) {
      alert("لا يوجد فيديو للنشر.");
      return;
    }

    // Prepare raw payload for background upload
    const combinedText = `${details.description}`;

    // Convert voiceover blob to File if it exists
    let voiceoverFile: File | undefined = undefined;
    if (voiceoverBlob) {
        voiceoverFile = new File([voiceoverBlob], 'voiceover.webm', { type: 'audio/webm' });
    }

    const postPayload = {
      text: combinedText,
      title: details.title,
      // Pass raw files to App.tsx
      rawVideoFile: videoFile,
      rawCoverFile: details.coverFile,
      rawVoiceoverFile: voiceoverFile, // Pass voiceover file
      // Metadata
      category: details.category,
      isShort: true,
      // Comprehensive Video Overlays Object
      videoOverlays: {
          texts: overlayTexts,
          stickers: overlayStickers,
          filter: selectedFilter,
          voiceover: voiceoverBlob ? { blob: voiceoverBlob } : null,
          audioSettings: audioSettings
      },
      // Pass the selected filter style separately for preview if needed, though now in videoOverlays
      videoFilter: selectedFilter,
      allowComments: details.allowComments,
      allowDownload: details.allowDownload,
      allowDuet: details.allowDuet,
      privacy: details.privacy,
      publishScope: 'category_only',
      // Temp preview for UI
      tempVideoUrl: videoSrc,
      
      // New Fields
      hashtags: details.hashtags,
      mentions: details.mentions,
      websiteLink: details.websiteLink,
      location: details.location,
      promotion: details.promotion
    };
    
    onPostSubmit(postPayload);
    // Set flag so ShortsView knows to refresh cache next time it loads
    localStorage.setItem('just_posted_short', 'true');
  };


  switch (step) {
    case 'record':
      return <CreateVideoView onClose={onClose} onVideoReady={handleVideoReady} />;
    case 'edit':
      if (videoSrc) {
        return <EditVideoView 
                  videoSrc={videoSrc} 
                  onBack={handleBackToRecord} 
                  onNext={handleProceedToPublish}
                  initialTexts={overlayTexts}
                  initialStickers={overlayStickers}
                  // Pass filter state props
                  currentFilter={selectedFilter}
                  onFilterChange={setSelectedFilter}
               />;
      }
      return null; // Should not happen
    case 'publish':
      if (videoSrc) {
        return (
            <PublishVideoView 
                videoSrc={videoSrc} 
                onBack={handleBackToEdit} 
                onPublish={handlePublish} 
                isSubmitting={isSubmitting}
                overlayTexts={overlayTexts}
                overlayStickers={overlayStickers}
                // Pass filter state prop to apply on preview
                appliedFilter={selectedFilter}
            />
        );
      }
      return null; // Should not happen
    default:
      return null;
  }
};

export default CreateShortFlow;
