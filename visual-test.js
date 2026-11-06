// Local visual QA only. Public deployments must ignore every test parameter.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const SCENES = new Set(['home', 'hub', 'ending', 'certificate', 'rest', 'classroom', 'research', 'office', 'copier', 'exterior']);
const DISABLED = Object.freeze({enabled:false,scene:'home',mission:null,renderer:'auto',bed:'bed-4',posture:'back',quality:'medium',clock:null});

export function readVisualTestRoute(location = globalThis.location) {
  if (!location || !['http:', 'https:'].includes(location.protocol) || !LOOPBACK_HOSTS.has(String(location.hostname).toLowerCase())) return DISABLED;
  const params = new URLSearchParams(location.search || '');
  if (params.get('test') !== '1') return DISABLED;
  const missionText = params.get('mission') || '';
  const mission = /^(?:[1-9]|10)$/.test(missionText) ? Number(missionText) : null;
  const scene = SCENES.has(params.get('scene')) ? params.get('scene') : 'home';
  const quality = ['low', 'medium', 'high'].includes(params.get('quality')) ? params.get('quality') : 'medium';
  const bed = /^[1-5]$/.test(params.get('bed') || '') ? 'bed-' + params.get('bed') : 'bed-4';
  // Optional school-clock time for daylight checks, 16:00–22:00 only.
  const clockMatch = /^(1[6-9]|2[0-2]):([0-5]\d)$/.exec(params.get('clock') || '');
  const clockMinutes = clockMatch ? Number(clockMatch[1]) * 60 + Number(clockMatch[2]) : null;
  const clock = clockMinutes !== null && clockMinutes <= 22 * 60 ? clockMinutes : null;
  return Object.freeze({enabled:true,scene,mission,renderer:params.get('renderer')==='software'?'software':'auto',bed,posture:params.get('posture')==='side'?'side':'back',quality,clock});
}

export function wantsSoftwareRenderer(location = globalThis.location) {
  return readVisualTestRoute(location).renderer === 'software';
}
