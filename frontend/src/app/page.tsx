'use client';

import { useEffect, useState } from 'react';
import api, { adminApi } from '../services/api';

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
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if API URL is defined
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    
    if (!apiUrl) {
      setError('API URL is not defined. Please set the NEXT_PUBLIC_API_URL environment variable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    adminApi.getAffiliates()
      .then((res) => {
        setAffiliates(res.data.affiliates);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching affiliates:', err);
        
        // Provide more specific error messages based on the error
        if (err.message === 'Network Error') {
          setError(
            'Unable to connect to the API server. Please ensure the backend is running and accessible at: ' + 
            apiUrl
          );
        } else {
          setError(err.message || 'Failed to fetch affiliates');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Loading affiliates...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>Error loading affiliates: {error}</p>
        <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f8f8f8', borderRadius: 4 }}>
          <h3>Troubleshooting Tips:</h3>
          <ul>
            <li>Ensure the backend API is running</li>
            <li>Check that NEXT_PUBLIC_API_URL is set correctly in your environment</li>
            <li>Verify network connectivity between frontend and backend</li>
            <li>Check for CORS issues if frontend and backend are on different domains/ports</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Affiliate Users</h1>
      {affiliates.length === 0 ? (
        <p>No affiliates found.</p>
      ) : (
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
      )}
    </main>
  );
}