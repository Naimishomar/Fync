import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StampCard } from '../ui/kit';
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
        { id: 'merge', title: 'Merge PDF', description: 'Join several PDFs into one file, in the order you pick.', icon: 'git-merge-outline', color: '#F97316', route: 'MergePdfScreen' },
        { id: 'split', title: 'Split PDF', description: 'Pull a page range out into its own document.', icon: 'cut-outline', color: '#F97316', route: 'SplitPdfScreen' },
        { id: 'extract', title: 'Extract Pages', description: 'Keep only the pages you name.', icon: 'documents-outline', color: '#F97316', route: 'ExtractPagesScreen' },
        { id: 'remove', title: 'Remove Pages', description: 'Delete pages you do not need.', icon: 'trash-outline', color: '#F97316', route: 'RemovePagesScreen' },
        { id: 'organize', title: 'Reorder Pages', description: 'Put pages in any order, or reverse them.', icon: 'swap-vertical-outline', color: '#F97316', route: 'OrganizePagesScreen' },
        { id: 'rotate', title: 'Rotate PDF', description: 'Turn sideways scans the right way up.', icon: 'refresh-outline', color: '#F97316', route: 'RotatePdfScreen' },
      ],
    },
    {
      id: 'edit',
      title: 'Edit',
      tools: [
        { id: 'numbers', title: 'Page Numbers', description: 'Number every page for assignments and reports.', icon: 'list-outline', color: '#7C3AED', route: 'PageNumbersScreen' },
        { id: 'watermark', title: 'Add Watermark', description: 'Stamp text across every page.', icon: 'water-outline', color: '#7C3AED', route: 'WatermarkPdfScreen' },
        { id: 'crop', title: 'Crop Margins', description: 'Trim white space so text fills the screen.', icon: 'crop-outline', color: '#7C3AED', route: 'CropPdfScreen' },
      ],
    },
    {
      id: 'convert',
      title: 'Convert',
      tools: [
        { id: 'scan', title: 'Scan to PDF', description: 'Photograph notes page by page into one PDF.', icon: 'camera-outline', color: '#0891B2', route: 'ScanToPdfScreen' },
        { id: 'imageToPdf', title: 'Image to PDF', description: 'Turn pictures already on your phone into a PDF.', icon: 'document-text-outline', color: '#0891B2', route: 'ImageToPdfScreen' },
        { id: 'urlToPdf', title: 'Web Page to PDF', description: 'Save a notice or article to read offline.', icon: 'globe-outline', color: '#0891B2', route: 'UrlToPdfScreen' },
        { id: 'pdfToImages', title: 'PDF to Images', description: 'Export each page as a JPG.', icon: 'image-outline', color: '#0891B2', route: 'PdfToImagesScreen' },
        { id: 'pdfToText', title: 'Extract Text', description: 'Copy the text out of a PDF into your notes.', icon: 'text-outline', color: '#0891B2', route: 'PdfToTextScreen' },
      ],
    },
    {
      id: 'images',
      title: 'Images',
      tools: [
        { id: 'imageCompressor', title: 'Image Compressor', description: 'Shrink photos to fit university upload limits.', icon: 'contract-outline', color: '#DB2777', route: 'ImageCompressorScreen' },
        { id: 'qrCode', title: 'QR Generator', description: 'Make a QR code for any link or text.', icon: 'qr-code-outline', color: '#DB2777', route: 'QRCodeToolScreen' },
      ],
    },
  ];
  const toolCount = groups.reduce((n, g) => n + g.tools.length, 0);

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F2EC' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View className="px-5 py-4 flex-row items-center justify-between border-b border-line bg-transparent">
          <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink">Utility Hub</Text>
        </View>
        <Ionicons name="construct-outline" size={24} color="#F97316" />
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <StampCard style={{ marginBottom: 24 }}>
          <View className="p-card-pad flex-row items-start" style={{ gap: 12 }}>
            <Ionicons name="lock-closed-outline" size={26} color="#047857" />
            <View className="flex-1">
              <Text className="font-semibold text-base text-ink">Everything runs on your phone</Text>
              <Text className="font-sans text-sm text-ink-2 mt-2">
                Files never leave the device. No internet, no cost, no account.
              </Text>
            </View>
          </View>
        </StampCard>

        {groups.map((group) => (
          <View key={group.id}>
            <View className="flex-row items-center mt-2 mb-3" style={{ gap: 12 }}>
              <Text className="font-display text-label text-ink uppercase">{group.title}</Text>
              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
              <Text className="font-display text-label text-ink-3">{group.tools.length}</Text>
            </View>

            <View className="flex-col gap-4 mb-6">
              {group.tools.map((tool) => (
                <TouchableOpacity
                  key={tool.id}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate(tool.route)}
                  className="bg-card rounded-card p-5 border border-line shadow-hair flex-row items-center"
                  accessibilityRole="button"
                >
                  <View
                    style={{ backgroundColor: tool.color }}
                    className="w-14 h-14 rounded-card items-center justify-center border-2 border-ink"
                  >
                    <Ionicons name={tool.icon as any} size={26} color="#12100E" />
                  </View>
                  <View className="flex-1 ml-4">
                    <Text className="text-lg font-display text-ink mb-1">{tool.title}</Text>
                    <Text className="text-xs text-ink-3 font-medium leading-tight pr-2">
                      {tool.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#C4BEB6" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View className="pb-10" />
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}
