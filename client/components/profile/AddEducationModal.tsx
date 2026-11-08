import React, { useState, useEffect } from 'react';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { EducationEntry } from './EducationCard';
import { useAuth } from '../../context/auth.context';
import { Sheet, FormField, Button } from '../ui/kit';
import { ToggleRow } from './ProfileBits';

const FIELDS = [
  { label: 'Institution *', key: 'institution', ph: 'e.g. IIT Delhi, DPS School' },
  { label: 'Degree / level', key: 'degree', ph: 'e.g. B.Tech, 12th, MBA' },
  { label: 'Field / stream', key: 'field', ph: 'e.g. Computer Science, PCM' },
  { label: 'Grade / percentage', key: 'grade', ph: 'e.g. 9.2 CGPA, 92%' },
  { label: 'Start year', key: 'startYear', ph: '2020', num: true },
] as const;

export default function AddEducationModal({ visible, initial, onClose, onSuccess }: {
  visible: boolean; initial?: EducationEntry; onClose: () => void; onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    institution: user?.college || '', degree: '', field: '', grade: '',
    startYear: '', endYear: '', isCurrent: false, description: ''
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?._id;


  useEffect(() => {
    if (initial) {
      setForm({
        institution: initial.institution || '',
        degree: initial.degree || '',
        field: initial.field || '',
        grade: initial.grade || '',
        startYear: initial.startYear?.toString() || '',
        endYear: initial.endYear?.toString() || '',
        isCurrent: initial.isCurrent || false,
        description: initial.description || ''
      });
    } else {
      setForm({ institution: user?.college || '', degree: '', field: '', grade: '', startYear: '', endYear: '', isCurrent: false, description: '' });
    }
  }, [initial, visible]);

  const save = async () => {
    if (!form.institution.trim()) return Toast.show({ type: 'error', text1: 'Institution is required' });
    setSaving(true);
    try {
      const payload = { ...form, startYear: form.startYear ? Number(form.startYear) : undefined, endYear: form.endYear ? Number(form.endYear) : undefined };
      if (isEdit) await axios.patch(`/profile/education/${initial!._id}`, payload);
      else await axios.post('/profile/education', payload);
      Toast.show({ type: 'success', text1: isEdit ? 'Education updated!' : 'Education added!' });
      onSuccess();
    } catch { Toast.show({ type: 'error', text1: 'Failed to save' }); }
    finally { setSaving(false); }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? 'Edit education' : 'Add education'}
      height="85%"
      footer={<Button variant="primary" block icon={isEdit ? 'save-outline' : 'add'} title={isEdit ? 'Save changes' : 'Add education'} onPress={save} loading={saving} />}
    >
      {FIELDS.map(f => (
        <FormField
          key={f.key}
          label={f.label}
          placeholder={f.key === 'institution' ? user?.college || f.ph : f.ph}
          value={form[f.key]}
          onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
          keyboardType={'num' in f ? 'numeric' : 'default'}
          containerStyle={{ marginBottom: 16 }}
        />
      ))}

      <ToggleRow label="Currently studying here" value={form.isCurrent} onChange={v => setForm(p => ({ ...p, isCurrent: v }))} />

      {!form.isCurrent ? (
        <FormField label="End year" placeholder="2024" keyboardType="numeric" value={form.endYear}
          onChangeText={v => setForm(p => ({ ...p, endYear: v }))} containerStyle={{ marginBottom: 16 }} />
      ) : null}

      <FormField label="Description" placeholder="Clubs, achievements, projects..." multiline value={form.description}
        onChangeText={v => setForm(p => ({ ...p, description: v }))} />
    </Sheet>
  );
}
