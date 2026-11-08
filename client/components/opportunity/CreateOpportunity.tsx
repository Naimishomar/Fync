import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Switch, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Button, Card, Chip, FormField, IconTile, Label, SegmentedTabs, TagRow } from '../ui/kit';

const TYPE_LABELS = { internship: 'Internship', job: 'Full-time job' } as const;
const TYPES = ['internship', 'job'] as const;

const SelectionGroup = ({ label, options, field, formData, setFormData }: { label: string, options: string[], field: string, formData: any, setFormData: (v: any) => void }) => (
  <View style={{ gap: 8 }}>
    <Label>{label}</Label>
    <TagRow>
      {options.map((opt) => (
        <Chip key={opt} label={opt} active={formData[field] === opt} onPress={() => setFormData({ ...formData, [field]: opt })} />
      ))}
    </TagRow>
  </View>
);

const InputGroup = ({ label, value, onChange, placeholder, multiline = false }: any) => (
  <FormField label={label} value={value} onChangeText={onChange} placeholder={placeholder} multiline={multiline} />
);

const CreateOpportunity = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialType = route.params?.type || 'internship';
  const initialData = route.params?.initialData;
  const isEdit = !!initialData;

  const [loading, setLoading] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(initialData?.companyLogo || null);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    company: initialData?.company || '',
    location: initialData?.location || 'Remote',
    type: initialData?.type || initialType,
    opportunityType: initialData?.opportunityType || 'Full-Time',
    duration: initialData?.duration || '',
    isPaid: initialData?.isPaid || false,
    stipend: initialData?.stipend || '',
    description: initialData?.description || '',
    applicationLink: initialData?.applicationLink || '',
    requireResume: initialData?.requireResume !== false,
    experience: initialData?.experience || 'Fresher'
  });

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setLogoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Could not open your photos.");
    }
  };

  const handlePost = async () => {
    const { title, company, description, isPaid, stipend } = formData;

    if (!title.trim() || !company.trim() || !description.trim()) {
      Alert.alert("Required Fields", "Please fill in Title, Company, and Description.");
      return;
    }

    if (!logoUri) {
      Alert.alert("Company Logo Required", "Please upload your company logo.");
      return;
    }

    if (isPaid && !stipend) {
      Alert.alert("Required Fields", "Please enter the stipend or package amount.");
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('company', formData.company);
      data.append('location', formData.location);
      data.append('type', formData.type);
      data.append('opportunityType', formData.opportunityType);
      data.append('duration', formData.duration);
      data.append('isPaid', String(formData.isPaid));
      data.append('stipend', formData.isPaid ? formData.stipend : 'Unpaid');
      data.append('description', formData.description);
      data.append('applicationLink', formData.applicationLink);
      data.append('requireResume', String(formData.requireResume));
      data.append('experience', formData.experience);
      // Append logo image if newly picked
      if (logoUri && !logoUri.startsWith('http')) {
        const uriParts = logoUri.split('.');
        // "image/jpg" is not a MIME type; servers that check it reject the upload.
        const ext = uriParts[uriParts.length - 1].toLowerCase();
        const fileType = ext === 'jpg' ? 'jpeg' : ext;
        data.append('companyLogo', {
          uri: logoUri,
          name: `logo.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }

      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
      };

      let res;
      if (isEdit) {
        res = await axios.patch(`/opportunity/update/${initialData._id}`, data, config);
      } else {
        res = await axios.post('/opportunity/create', data, config);
      }

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: isEdit ? 'Opportunity Updated!' : 'Opportunity Posted!',
          text2: 'Your changes are now live.'
        });
        navigation.goBack();
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || "Failed to post opportunity.";
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
      <AppBar title={isEdit ? 'Edit opportunity' : 'Post opportunity'} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-gutter" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SegmentedTabs
            items={TYPES}
            labels={TYPE_LABELS}
            value={formData.type}
            onChange={(t) => setFormData({ ...formData, type: t })}
            style={{ marginTop: 16 }}
          />

          <View className="mt-6 pb-10" style={{ gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Label>Company logo *</Label>
              <Pressable
                onPress={pickLogo}
                accessibilityRole="button"
                accessibilityLabel={logoUri ? 'Change company logo' : 'Upload company logo'}
                className="items-center justify-center bg-paper-2 border border-dashed border-line rounded-2xl p-6 active:opacity-85"
              >
                {logoUri ? (
                  <View className="items-center">
                    <Image source={{ uri: logoUri }} style={{ width: 96, height: 96, borderRadius: 16 }} contentFit="contain" />
                    <Text className="text-accent-text font-semibold text-sm mt-3">Tap to change</Text>
                  </View>
                ) : (
                  <View className="items-center">
                    <IconTile icon="image-outline" size={56} color={C.ink3} style={{ marginBottom: 12 }} />
                    <Text className="font-semibold text-base text-ink">Upload company logo</Text>
                    <Text className="text-ink-3 text-xs mt-1">PNG or JPG · square works best</Text>
                  </View>
                )}
              </Pressable>
            </View>

            <InputGroup
              label="Role title *"
              value={formData.title}
              placeholder="e.g. Backend Developer Intern"
              onChange={(v: any) => setFormData({ ...formData, title: v })}
            />

            <InputGroup
              label="Company name *"
              value={formData.company}
              placeholder="e.g. Google India"
              onChange={(v: any) => setFormData({ ...formData, company: v })}
            />

            <SelectionGroup
              label="Location *"
              options={["Remote", "Onsite", "Hybrid"]}
              field="location"
              formData={formData} setFormData={setFormData} />

            <SelectionGroup
              label="Work schedule *"
              options={["Full-Time", "Part-Time"]}
              field="opportunityType"
              formData={formData} setFormData={setFormData} />

            <SelectionGroup
              label="Experience required *"
              options={["Fresher", "Entry Level", "1-2 Years", "3-5 Years", "5+ Years"]}
              field="experience"
              formData={formData} setFormData={setFormData} />

            <View style={{ gap: 8 }}>
              <Label>Payment *</Label>
              <TagRow>
                {["Unpaid", "Paid"].map(opt => (
                  <Chip
                    key={opt}
                    label={opt}
                    active={formData.isPaid === (opt === 'Paid')}
                    onPress={() => setFormData({ ...formData, isPaid: opt === 'Paid' })}
                  />
                ))}
              </TagRow>
            </View>
            {formData.isPaid ? (
              <InputGroup
                label={formData.type === 'internship' ? "Stipend amount *" : "Package / salary *"}
                value={formData.stipend}
                placeholder="e.g. ₹25k / ₹12 LPA"
                onChange={(v: any) => setFormData({ ...formData, stipend: v })}
              />
            ) : null}

            {formData.type === 'internship' ? (
              <InputGroup
                label="Duration"
                value={formData.duration}
                placeholder="e.g. 6 months / performance based"
                onChange={(v: any) => setFormData({ ...formData, duration: v })}
              />
            ) : null}

            <InputGroup
              label="Application link (optional)"
              value={formData.applicationLink}
              placeholder="https://company.com/careers/..."
              onChange={(v: any) => setFormData({ ...formData, applicationLink: v })}
            />

            <Card padded style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View className="flex-1">
                <Text className="font-semibold text-base text-ink">Require resume</Text>
                <Text className="text-ink-3 text-sm mt-0.5">Candidates must share their resume to apply</Text>
              </View>
              <Switch
                value={formData.requireResume}
                onValueChange={(v) => setFormData({ ...formData, requireResume: v })}
                trackColor={{ false: C.line, true: C.fam.fun }}
                thumbColor={formData.requireResume ? C.brand[500] : C.ink3}
                accessibilityLabel="Require resume"
              />
            </Card>

            <InputGroup
              label="Description *"
              value={formData.description}
              placeholder="Key responsibilities, skills and about the role..."
              multiline
              onChange={(v: any) => setFormData({ ...formData, description: v })}
            />

            <Button
              title={isEdit ? 'Save changes' : 'Post opportunity'}
              variant="primary"
              block
              loading={loading}
              onPress={handlePost}
              style={{ marginTop: 8 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default CreateOpportunity;
