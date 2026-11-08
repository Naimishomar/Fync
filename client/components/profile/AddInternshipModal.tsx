import React, { useState, useEffect } from 'react';
import { Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { C } from '../../constants/colors';
import { Sheet, FormField, Button } from '../ui/kit';
import { ChoiceChips, FieldLabel, ToggleRow } from './ProfileBits';

const TYPES = ['internship', 'full-time', 'part-time', 'freelance', 'contract', 'open-source'];
const MODES = ['remote', 'onsite', 'hybrid'];

interface Props {
  visible: boolean;
  initial?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELDS = [
  { label: 'Company *', key: 'company', ph: 'e.g. Google' },
  { label: 'Role *', key: 'role', ph: 'e.g. SDE Intern' },
  { label: 'Description', key: 'description', ph: 'What did you work on?', multi: true },
  { label: 'Tech stack', key: 'techStack', ph: 'React, Node.js, etc (comma separated)' },
  { label: 'Location', key: 'location', ph: 'Bangalore, India' },
  { label: 'Start date (YYYY-MM-DD) *', key: 'startDate', ph: '2024-06-01' },
] as const;

export default function AddInternshipModal({ visible, initial, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    company: '', role: '', type: 'internship', description: '',
    techStack: '', startDate: '', endDate: '', isCurrentlyWorking: false,
    location: '', workMode: 'remote',
  });
  const [offerLetter, setOfferLetter] = useState<any>(null);
  const [completionCertificate, setCompletionCertificate] = useState<any>(null);
  const [existingOfferLetter, setExistingOfferLetter] = useState<string | null>(null);
  const [existingCertificate, setExistingCertificate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?._id;

  useEffect(() => {
    if (initial) {
      setForm({
        company: initial.company || '',
        role: initial.role || '',
        type: initial.type || 'internship',
        description: initial.description || '',
        techStack: (initial.techStack || []).join(', '),
        startDate: initial.startDate ? initial.startDate.slice(0, 10) : '',
        endDate: initial.endDate ? initial.endDate.slice(0, 10) : '',
        isCurrentlyWorking: initial.isCurrentlyWorking || false,
        location: initial.location || '',
        workMode: initial.workMode || 'remote',
      });
      setExistingOfferLetter(initial.offerLetterUrl || null);
      setExistingCertificate(initial.completionCertificateUrl || null);
      setOfferLetter(null);
      setCompletionCertificate(null);
    } else {
      setForm({ company: '', role: '', type: 'internship', description: '', techStack: '', startDate: '', endDate: '', isCurrentlyWorking: false, location: '', workMode: 'remote' });
      setExistingOfferLetter(null);
      setExistingCertificate(null);
      setOfferLetter(null);
      setCompletionCertificate(null);
    }
  }, [initial, visible]);

  const pickDocument = async (field: 'offer' | 'cert') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        if (field === 'offer') setOfferLetter(result.assets[0]);
        else setCompletionCertificate(result.assets[0]);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error picking document' });
    }
  };

  const save = async () => {
    if (!form.company.trim() || !form.role.trim() || !form.startDate)
      return Toast.show({ type: 'error', text1: 'Company, role and start date are required' });

    if (form.isCurrentlyWorking && !offerLetter && !existingOfferLetter) {
        return Toast.show({ type: 'error', text1: 'Offer letter is required for current jobs' });
    }
    if (!form.isCurrentlyWorking && !completionCertificate && !existingCertificate) {
        return Toast.show({ type: 'error', text1: 'Completion certificate is required for past jobs' });
    }

    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
          if (key === 'techStack' && typeof val === 'string') {
              val.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => {
                  formData.append('techStack', s);
              });
          } else {
              formData.append(key, String(val));
          }
      });

      if (offerLetter) {
          formData.append('offerLetter', {
              uri: Platform.OS === 'ios' ? offerLetter.uri.replace('file://', '') : offerLetter.uri,
              name: offerLetter.name || 'offer_letter.pdf',
              type: 'application/pdf'
          } as any);
      }
      if (completionCertificate) {
          formData.append('completionCertificate', {
              uri: Platform.OS === 'ios' ? completionCertificate.uri.replace('file://', '') : completionCertificate.uri,
              name: completionCertificate.name || 'certificate.pdf',
              type: 'application/pdf'
          } as any);
      }

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEdit) {
        await axios.patch(`/profile/internships/${initial._id}`, formData, config);
        Toast.show({ type: 'success', text1: 'Experience updated!' });
      } else {
        await axios.post('/profile/internships', formData, config);
        Toast.show({ type: 'success', text1: 'Experience added!' });
      }
      onSuccess();
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const current = form.isCurrentlyWorking;
  const picked = current ? offerLetter : completionCertificate;
  const existing = current ? existingOfferLetter : existingCertificate;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? 'Edit experience' : 'Add experience'}
      height="85%"
      footer={<Button variant="primary" block icon={isEdit ? 'save-outline' : 'add'} title={isEdit ? 'Save changes' : 'Add experience'} onPress={save} loading={saving} />}
    >
      <ChoiceChips label="Type" items={TYPES} value={form.type} onChange={t => setForm(p => ({ ...p, type: t }))} />

      {FIELDS.map(f => (
        <FormField
          key={f.key}
          label={f.label}
          placeholder={f.ph}
          value={form[f.key]}
          onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
          multiline={'multi' in f}
          containerStyle={{ marginBottom: 16 }}
        />
      ))}

      <ToggleRow label="I currently work here" value={current} onChange={v => setForm(p => ({ ...p, isCurrentlyWorking: v }))} />

      {!current ? (
        <FormField label="End date (YYYY-MM-DD)" placeholder="2024-09-30" value={form.endDate}
          onChangeText={v => setForm(p => ({ ...p, endDate: v }))} containerStyle={{ marginBottom: 16 }} />
      ) : null}

      <ChoiceChips label="Work mode" items={MODES} value={form.workMode} onChange={m => setForm(p => ({ ...p, workMode: m }))} />

      <FieldLabel>{current ? 'Offer letter (PDF) *' : 'Completion certificate (PDF) *'}</FieldLabel>
      <Pressable
        onPress={() => pickDocument(current ? 'offer' : 'cert')}
        accessibilityRole="button"
        accessibilityLabel={current ? 'Upload offer letter' : 'Upload completion certificate'}
        className="bg-paper-2 border border-line px-4 rounded-2xl flex-row items-center active:opacity-70"
        style={{ minHeight: 56, gap: 12 }}
      >
        <Feather name={current ? 'file-text' : 'award'} size={18} color={C.ink2} />
        <Text className="text-ink text-sm font-sans flex-1" numberOfLines={1}>
          {picked ? picked.name : existing ? (current ? 'Offer letter uploaded' : 'Certificate uploaded') : 'Choose a PDF'}
        </Text>
        <Feather name="upload" size={16} color={C.ink3} />
      </Pressable>
      <Text className="text-ink-3 text-xs font-sans mt-2">
        {current ? 'Required for a current role.' : 'Required for a past role.'}
      </Text>
    </Sheet>
  );
}
