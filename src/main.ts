import '@fontsource/vt323';
import './styles/theme.css';
import './styles/scene.css';
import { fitStage } from './scene/stage';

const stage = document.getElementById('stage')!;
fitStage(stage);
