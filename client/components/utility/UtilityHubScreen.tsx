import React, { Fragment } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, Card, Divider, IconTile, ListRow, SectionHeader } from '../ui/kit';
import { C } from '../../constants/colors';
export default function UtilityHubScreen() {
  const navigation = useNavigation<any>();

  // Grouped so the hub stays readable past a dozen tools. Every tool here runs
  // on-device: pdf-lib for page work, expo-print for creating, and a vendored
  // copy of pdf.js for anything that needs a page rendered.
  const groups = [
    {
      id: 'organize',
      title: 'Organize',
      tools: [
        { id: 'merge', title: 'Merge PDF', description: 'Join several PDFs into one file, in the order you pick.', icon: 'git-merge-outline', route: 'MergePdfScreen' },
        { id: 'split', title: 'Split PDF', description: 'Pull a page range out into its own document.', icon: 'cut-outline', route: 'SplitPdfScreen' },
        { id: 'extract', title: 'Extract Pages', description: 'Keep only the pages you name.', icon: 'documents-outline', route: 'ExtractPagesScreen' },
        { id: 'remove', title: 'Remove Pages', description: 'Delete pages you do not need.', icon: 'trash-outline', route: 'RemovePagesScreen' },
        { id: 'organize', title: 'Reorder Pages', description: 'Put pages in any order, or reverse them.', icon: 'swap-vertical-outline', route: 'OrganizePagesScreen' },
        { id: 'rotate', title: 'Rotate PDF', description: 'Turn sideways scans the right way up.', icon: 'refresh-outline', route: 'RotatePdfScreen' },
      ],
    },
    {
      id: 'edit',
      title: 'Edit',
      tools: [
        { id: 'numbers', title: 'Page Numbers', description: 'Number every page for assignments and reports.', icon: 'list-outline', route: 'PageNumbersScreen' },
        { id: 'watermark', title: 'Add Watermark', description: 'Stamp text across every page.', icon: 'water-outline', route: 'WatermarkPdfScreen' },
        { id: 'crop', title: 'Crop Margins', description: 'Trim white space so text fills the screen.', icon: 'crop-outline', route: 'CropPdfScreen' },
      ],
    },
    {
      id: 'convert',
      title: 'Convert',
      tools: [
        { id: 'scan', title: 'Scan to PDF', description: 'Photograph notes page by page into one PDF.', icon: 'camera-outline', route: 'ScanToPdfScreen' },
        { id: 'imageToPdf', title: 'Image to PDF', description: 'Turn pictures already on your phone into a PDF.', icon: 'document-text-outline', route: 'ImageToPdfScreen' },
        { id: 'urlToPdf', title: 'Web Page to PDF', description: 'Save a notice or article to read offline.', icon: 'globe-outline', route: 'UrlToPdfScreen' },
        { id: 'pdfToImages', title: 'PDF to Images', description: 'Export each page as a JPG.', icon: 'image-outline', route: 'PdfToImagesScreen' },
        { id: 'pdfToText', title: 'Extract Text', description: 'Copy the text out of a PDF into your notes.', icon: 'text-outline', route: 'PdfToTextScreen' },
      ],
    },
    {
      id: 'images',
      title: 'Images',
      tools: [
        { id: 'imageCompressor', title: 'Image Compressor', description: 'Shrink photos to fit university upload limits.', icon: 'contract-outline', route: 'ImageCompressorScreen' },
        { id: 'qrCode', title: 'QR Generator', description: 'Make a QR code for any link or text.', icon: 'qr-code-outline', route: 'QRCodeToolScreen' },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-paper">
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <AppBar title="Utility Hub" onBack={() => navigation.goBack()} />

        <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          <Card padded style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <IconTile icon="lock-closed-outline" color={C.success} />
            <View className="flex-1">
              <Text className="font-semibold text-base text-ink">Everything runs on your phone</Text>
              <Text className="font-sans text-sm text-ink-2 mt-1">
                Files never leave the device. No internet, no cost, no account.
              </Text>
            </View>
          </Card>

          {groups.map((group) => (
            <View key={group.id}>
              <SectionHeader title={group.title} count={group.tools.length} />
              <Card style={{ paddingHorizontal: 16 }}>
                {group.tools.map((tool, i) => (
                  <Fragment key={tool.id}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      icon={tool.icon as any}
                      title={tool.title}
                      subtitle={tool.description}
                      subtitleLines={2}
                      onPress={() => navigation.navigate(tool.route)}
                    />
                  </Fragment>
                ))}
              </Card>
            </View>
          ))}
          <View className="pb-10" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
