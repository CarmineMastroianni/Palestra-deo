import { Route, Routes } from 'react-router-dom';
import { PersonalSettings, ScheduleSettings, TimerSettingsPage, ProgressionSettingsPage, AppearanceSettings } from './GeneralSettings';
import { TemplatesList, TemplateEditor } from './Templates';
import { ExercisesList, ExerciseEditor } from './Exercises';
import { PhasesSettings } from './Phases';
import { AiSettingsPage, CloudSettingsPage } from './Connectivity';
import { DataSettings, SecuritySettingsPage } from './DataSecurity';
import { StatusPage } from './Status';

export default function SettingsRoutes() {
  return (
    <Routes>
      <Route path="dati-personali" element={<PersonalSettings />} />
      <Route path="programma" element={<ScheduleSettings />} />
      <Route path="schede" element={<TemplatesList />} />
      <Route path="schede/:id" element={<TemplateEditor />} />
      <Route path="esercizi" element={<ExercisesList />} />
      <Route path="esercizi/:id" element={<ExerciseEditor />} />
      <Route path="fasi" element={<PhasesSettings />} />
      <Route path="timer" element={<TimerSettingsPage />} />
      <Route path="progressione" element={<ProgressionSettingsPage />} />
      <Route path="ai" element={<AiSettingsPage />} />
      <Route path="cloud" element={<CloudSettingsPage />} />
      <Route path="dati" element={<DataSettings />} />
      <Route path="sicurezza" element={<SecuritySettingsPage />} />
      <Route path="aspetto" element={<AppearanceSettings />} />
      <Route path="stato" element={<StatusPage />} />
    </Routes>
  );
}
