import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const API_URL = process.env.API_URL || 'http://localhost:8083/api/';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const authHeader = request.headers.get('Authorization') ?? '';

  const res = await fetch(`${baseUrl}/admin/members/search?${query}`, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  console.log('[members/search] status:', res.status, 'url:', `${baseUrl}/admin/members/search?${query}`);
  console.log('[members/search] raw response:', text.slice(0, 200));

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Backend returned non-JSON', raw: text.slice(0, 500) }, { status: 502 });
  }
  return NextResponse.json(data, { status: res.status });
}