import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../components/ai/ai-components.css';
import { AiCoachWorkspace } from '../../features/ai-coach/index.js';

const root = createRoot(document.getElementById('aiCoachRoot'));
root.render(<AiCoachWorkspace />);
