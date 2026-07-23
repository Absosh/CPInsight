import React from 'react';
import { createRoot } from 'react-dom/client';
import { AiCoachWorkspace } from '../../features/ai-coach/index.js';

const root = createRoot(document.getElementById('aiCoachRoot'));
root.render(<AiCoachWorkspace />);
