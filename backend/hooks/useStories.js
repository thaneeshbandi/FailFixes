import { useState, useEffect } from 'react';

export const useStories = (filters = {}) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      
      if (filters.category && filters.category !== 'all') {
        queryParams.append('category', filters.category);
      }
      if (filters.search) {
        queryParams.append('search', filters.search);
      }
      if (filters.tags?.length > 0) {
        queryParams.append('tags', filters.tags.join(','));
      }
      if (filters.page) {
        queryParams.append('page', filters.page);
      }

      const response = await fetch(`http://localhost:5000/api/stories/browse?${queryParams}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch stories');
      }

      setStories(data.stories || []);
      setPagination(data.pagination || {});
      
    } catch (err) {
      console.error('Error fetching stories:', err);
      setError(err.message);
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, [filters.category, filters.search, filters.page]);

  return { stories, loading, error, pagination, refetch: fetchStories };
};
