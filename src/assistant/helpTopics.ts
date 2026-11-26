/** The help for the page on screen, and the general 'app' topics, limited to what the signed-in user may open. */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { HELP_TOPICS } from '@/help/content';
import { topicForPath, visibleTopics } from '@/help/types';

export function usePageHelp() {
  const { can } = useAuth();
  const { pathname } = useLocation();
  return useMemo(() => {
    const visible = visibleTopics(HELP_TOPICS, can);
    const pageTopic = topicForPath(pathname, visible);
    const appTopics = visible.filter((t) => t.module === 'app');
    // The page first, then the general topics: source of demo answers and suggested questions.
    const chatTopics = [...(pageTopic ? [pageTopic] : []), ...appTopics.filter((t) => t !== pageTopic)];
    return { pageTopic, appTopics, chatTopics };
  }, [can, pathname]);
}
