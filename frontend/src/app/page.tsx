'use client';

import { useEffect, useState } from 'react';
import api from '../services/api';

interface Affiliate {
  id: string;
  name: string;
  email: string;
  level: string;
  affiliateCode: string;
}

export default function HomePage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/affiliates')
      .then((res) => {
        setAffiliates(res.data.affiliates);
      })
      .catch((err) => {
        console.error('Error fetching affiliates:', err);
        setError(err.message || 'Failed to fetch affiliates');
      });
  }, []);

  if (error) {
    return <p style={{ color: 'red' }}>Error loading affiliates: {error}</p>;
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Affiliate Users</h1>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: 16,
        }}
      >
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>ID</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Name</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Email</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Level</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Code</th>
          </tr>
        </thead>
        <tbody>
          {affiliates.map((a) => (
            <tr key={a.id}>
              <td style={{ border: '1px solid #eee', padding: 8 }}>{a.id}</td>
              <td style={{ border: '1px solid #eee', padding: 8 }}>{a.name}</td>
              <td style={{ border: '1px solid #eee', padding: 8 }}>{a.email}</td>
              <td style={{ border: '1px solid #eee', padding: 8 }}>{a.level}</td>
              <td style={{ border: '1px solid #eee', padding: 8 }}>{a.affiliateCode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}