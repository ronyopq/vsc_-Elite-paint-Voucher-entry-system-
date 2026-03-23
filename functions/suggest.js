// Suggestions Route Handlers

import Database from '../shared/db.js';
import { requireAuth } from '../shared/auth.js';

// Get suggestions for a type
export async function handleSuggestGet(request, db, sessionManager, type) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  // Validate type
  const validTypes = ['payto', 'code', 'ac', 'particulars'];
  if (!validTypes.includes(type)) {
    return new Response(JSON.stringify({ error: 'Invalid type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let suggestions = await db.getSavedList(session.userId, type, 100);

    // Filter by query if provided
    if (query) {
      suggestions = suggestions.filter(s => 
        s.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Limit results
    suggestions = suggestions.slice(0, limit);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Suggest get error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Add to suggestion list
export async function handleSuggestAdd(request, db, sessionManager, type) {
  const [session, authError] = await requireAuth(request, sessionManager);

  if (authError) {
    return authError;
  }

  // Validate type
  const validTypes = ['payto', 'code', 'ac', 'particulars'];
  if (!validTypes.includes(type)) {
    return new Response(JSON.stringify({ error: 'Invalid type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = await request.json();

    if (!data.value || typeof data.value !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid value' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const value = data.value.trim();

    if (value.length === 0 || value.length > 500) {
      return new Response(JSON.stringify({ error: 'Value length invalid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.addToSavedList(session.userId, type, value);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Suggest add error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
