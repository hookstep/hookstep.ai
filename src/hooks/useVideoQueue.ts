import { useState, useCallback, useRef } from 'react';
import type { YouTubeVideo } from './useYouTubeSearch';

// const YOUTUBE_API_KEY = 'AIzaSyBIh4FDTNJ-uKOff6CIlxvubqGrJT_Bhb8';
const YOUTUBE_API_KEY = 'AIzaSyD07yW9SPGcQXmVf6jb61_pJKk3nrjEcnY';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

interface UseVideoQueueReturn {
  videos: YouTubeVideo[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  addVideosFromQuery: (query: string, replace?: boolean) => Promise<void>;
  goToNext: () => void;
  goToPrevious: () => void;
  clearQueue: () => void;
}

export function useVideoQueue(): UseVideoQueueReturn {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchedQueriesRef = useRef<Set<string>>(new Set());
  const currentQueryRef = useRef<string>('');

  const addVideosFromQuery = useCallback(async (query: string, replace: boolean = false) => {
    if (!query.trim()) return;
    
    const normalizedQuery = query.trim().toLowerCase();
    
    // If replacing, clear old videos and reset
    if (replace) {
      // Check if this is a different query than the current one
      if (normalizedQuery !== currentQueryRef.current.toLowerCase()) {
        setVideos([]);
        setCurrentIndex(0);
        searchedQueriesRef.current.clear();
        currentQueryRef.current = query.trim();
      } else {
        // Same query, don't search again
        return;
      }
    } else {
      // Normalize query to avoid duplicate searches
      if (searchedQueriesRef.current.has(normalizedQuery)) {
        return; // Already searched this query
      }
      searchedQueriesRef.current.add(normalizedQuery);
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const searchQuery = `${query} dance`;
      
      const params = new URLSearchParams({
        part: 'snippet',
        q: searchQuery,
        type: 'video',
        videoDuration: 'short',
        maxResults: '10',
        order: 'relevance',
        key: YOUTUBE_API_KEY,
      });

      const response = await fetch(`${YOUTUBE_API_URL}?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to search YouTube');
      }

      const data = await response.json();
      
      const newVideos: YouTubeVideo[] = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        description: item.snippet.description,
      }));

      // If replacing, set new videos and start from first video
      if (replace) {
        setVideos(newVideos);
        setCurrentIndex(0);
        searchedQueriesRef.current.add(normalizedQuery);
      } else {
        // Add new videos to the queue (stack on top)
        setVideos(prev => {
          // Filter out duplicates
          const existingIds = new Set(prev.map(v => v.id));
          const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v.id));
          const updatedVideos = [...uniqueNewVideos, ...prev];
          
          // Adjust current index: if no videos existed before, start at 0
          // Otherwise, adjust by the number of unique new videos added
          setTimeout(() => {
            if (prev.length === 0) {
              setCurrentIndex(0);
            } else if (uniqueNewVideos.length > 0) {
              setCurrentIndex(prevIndex => prevIndex + uniqueNewVideos.length);
            }
          }, 0);
          
          return updatedVideos;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search videos';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev < videos.length - 1) {
        const newIndex = prev + 1;
        // Remove videos below current position (already watched)
        setTimeout(() => {
          setVideos(currentVideos => currentVideos.slice(0, newIndex + 5));
        }, 100);
        return newIndex;
      }
      return prev;
    });
  }, [videos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const clearQueue = useCallback(() => {
    setVideos([]);
    setCurrentIndex(0);
    searchedQueriesRef.current.clear();
    currentQueryRef.current = '';
  }, []);

  return {
    videos,
    currentIndex,
    isLoading,
    error,
    addVideosFromQuery,
    goToNext,
    goToPrevious,
    clearQueue,
  };
}
