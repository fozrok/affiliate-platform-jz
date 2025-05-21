import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Affiliate {
  id: string;
  name: string;
  email: string;
  level: string;
  referrals: number;
  revenue: number;
}

const AffiliateTable: React.FC = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAffiliates = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken'); // Or use your auth state management
        const { data } = await axios.get('/api/admin/affiliates', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAffiliates(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load affiliates');
        setLoading(false);
      }
    };

    fetchAffiliates();
  }, []);

  const exportCSV = () => {
    // Convert affiliates to CSV
    const headers = ['ID', 'Name', 'Email', 'Level', 'Referrals', 'Revenue'];
    const csvContent = [
      headers.join(','),
      ...affiliates.map(a => 
        [a.id, a.name, a.email, a.level, a.referrals, a.revenue].join(',')
      )
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'affiliates.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Affiliate Partners
        </h3>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Export CSV
        </button>
      </div>
      <div className="border-t border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Referrals
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {affiliates.map((affiliate) => (
              <tr key={affiliate.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{affiliate.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{affiliate.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${affiliate.level === 'gold' ? 'bg-yellow-100 text-yellow-800' : 
                    affiliate.level === 'silver' ? 'bg-gray-100 text-gray-800' : 
                    'bg-yellow-800 text-white'}`}>
                    {affiliate.level}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {affiliate.referrals}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${affiliate.revenue.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AffiliateTable;
