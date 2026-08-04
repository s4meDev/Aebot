import React from 'react';
import type { ServiceRecord } from '../types';

interface ServiceDetailsProps {
  service: ServiceRecord;
}

export const ServiceDetails: React.FC<ServiceDetailsProps> = ({ service }) => {
  return (
    <div className="card service-details-card">
      <div className="service-header">
        <div>
          <span className="eyebrow-inline">{service.category}</span>
          <h2 className="service-title">{service.name}</h2>
        </div>
      </div>

      <p className="service-summary">{service.summary}</p>

      {/* Insights Section */}
      <div className="insights-container">
        <h4 className="insights-title">Insights e Diretrizes Operacionais</h4>
        <ul className="insights-list">
          {service.insights.map((insight, idx) => (
            <li key={idx} className="insight-item">
              <span className="insight-bullet"></span>
              <span className="insight-text">{insight}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
