import React from 'react';
import { ReflectionTimeline } from './ReflectionTimeline.jsx';

export function ReflectionFeed({ reflections = [] }) {
  return <ReflectionTimeline reflections={reflections} filters={['all', 'strength', 'weakness', 'pattern', 'strategy']} />;
}
