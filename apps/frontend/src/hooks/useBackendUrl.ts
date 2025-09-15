import { useState, useEffect } from 'react';

export function useBackendUrl() {
  const [backendUrl, setBackendUrl] = useState<string>('http://localhost:3001');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBackendUrl = async () => {
      try {
        const response = await fetch('/api/backend-url');
        const data = await response.json();

        if (data.backendUrl) {
          setBackendUrl(data.backendUrl);
          console.log('백엔드 URL 설정:', data.backendUrl, '모바일:', data.isMobile);
        }
      } catch (error) {
        console.error('백엔드 URL 가져오기 실패:', error);
        // 기본값 사용
        setBackendUrl('http://localhost:3001');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBackendUrl();
  }, []);

  return { backendUrl, isLoading };
}
