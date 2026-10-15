const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export { API_URL };

/**
 * Fetches current authenticated user profile.
 * GET /api/auth/me
 */
export async function fetchCurrentUser() {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`Unauthenticated (HTTP ${response.status})`);
  }
  return await response.json(); // { user: { id, email } }
}

/**
 * Logs out current user and clears session cookie.
 * POST /api/auth/logout
 */
export async function logoutUser() {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  return await response.json();
}

/**
 * Fetches user's GitHub repositories with live indexing status.
 * GET /api/user/repos
 */
export async function fetchUserRepos() {
  const response = await fetch(`${API_URL}/api/user/repos`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch user repositories (HTTP ${response.status})`);
  }
  return await response.json();
}

/**
 * Fetches persistent message history for a repository conversation.
 * GET /api/chat/:repoId/messages
 */
export async function fetchConversationMessages(repoId) {
  const response = await fetch(`${API_URL}/api/chat/${repoId}/messages`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch conversation messages (HTTP ${response.status})`);
  }
  return await response.json(); // { conversationId, messages }
}

/**
 * Submits a new repository URL for ingestion.
 * POST /api/repos
 */
export async function createRepository(repoUrl) {
  let name = repoUrl.trim();
  if (name.includes('github.com/')) {
    name = name.split('github.com/')[1].replace(/\.git$/, '').replace(/\/$/, '');
  }
  if (!name.includes('/')) {
    throw new Error('Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)');
  }

  const response = await fetch(`${API_URL}/api/repos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ repoUrl, name })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to submit repository (HTTP ${response.status})`);
  }

  return await response.json(); // { message, repoId }
}

/**
 * Fetches all public/global repositories from the backend.
 * GET /api/repos
 */
export async function fetchRepositories() {
  const response = await fetch(`${API_URL}/api/repos`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repositories (HTTP ${response.status})`);
  }
  return await response.json();
}

/**
 * Fetches a single repository status by ID for live polling.
 * GET /api/repos/:id
 */
export async function fetchRepoStatus(repoId) {
  const response = await fetch(`${API_URL}/api/repos/${repoId}`, {
    credentials: 'include'
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repo status (HTTP ${response.status})`);
  }
  return await response.json();
}

/**
 * Streams AI Generative RAG responses via Server-Sent Events (SSE).
 * POST /api/chat/stream
 */
export async function streamChatResponse({ repoId, query, messages = [], onToken, onError, onComplete }) {
  try {
    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ repoId, query, messages })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              onToken(parsed.text);
            }
            if (parsed.error) {
              onError(parsed.error);
            }
          } catch (err) {
            console.error('Failed to parse SSE chunk:', err);
          }
        }
      }
    }
    onComplete?.();
  } catch (err) {
    onError?.(err.message || 'Stream connection error');
  }
}
