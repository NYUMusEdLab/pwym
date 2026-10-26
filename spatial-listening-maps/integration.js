import {validateProject} from './model.js?v=0.3.0';
// Future notebook/capture boundary. Pure data only; caller chooses any transport.
export function createCapture(project) {
  const p=validateProject(project);
  return {schema:'org.nyumusedlab.capture',schemaVersion:1,kind:'listening-analysis',source:{app:'spatial-listening-maps',version:'0.3.0',projectId:p.id},capturedAt:new Date().toISOString(),interpretation:true,audioIncluded:false,project:p};
}
// Deliberately disabled until a provider, configuration, and consent flow are verified.
export const analytics = Object.freeze({enabled:false,track(_event,_consent=false){return false;}});
