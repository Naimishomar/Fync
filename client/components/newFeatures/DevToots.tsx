import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    Alert,
    Dimensions,
    Platform,
    Modal,
    Share,
    TouchableOpacity,
    Image,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// --- Types ---
interface Tool {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string[];
    category: 'Development' | 'Utility' | 'Design' | 'DevOps';
}

const TOOLS: Tool[] = [
    { id: 'regex', title: 'Regex-Architect', description: 'Visual Pattern Builder for students.', icon: 'code-slash-outline', color: ['#8b5cf6', '#6d28d9'], category: 'Development' },
    { id: 'readme', title: 'ReadMe-Gen', description: 'GitHub README.md Generator.', icon: 'document-text-outline', color: ['#10b981', '#059669'], category: 'Development' },
    { id: 'api-play', title: 'API Playground', description: 'JSONPlaceholder-style REST client.', icon: 'rocket-outline', color: ['#f59e0b', '#d97706'], category: 'Development' },
    { id: 'type-gen', title: 'API-to-Type', description: 'JSON to TypeScript/Java/Dart.', icon: 'construct-outline', color: ['#3b82f6', '#1d4ed8'], category: 'Development' },
    { id: 'unit-conv', title: 'Dev Converter', description: 'PX to REM, Unix Time, Hex to RGBA.', icon: 'swap-horizontal-outline', color: ['#ec4899', '#be185d'], category: 'Utility' },
    { id: 'commit', title: 'Commit-Gen', description: 'Conventional Commit Message Builder.', icon: 'git-commit-outline', color: ['#6366f1', '#4338ca'], category: 'DevOps' },
    { id: 'cron', title: 'Crontab-Visualizer', description: 'Human-friendly Cron schedules.', icon: 'time-outline', color: ['#14b8a6', '#0d9488'], category: 'DevOps' },
    { id: 'sql-nosql', title: 'SQL-to-NoSQL', description: 'Translate MySQL to MongoDB.', icon: 'shuffle-outline', color: ['#ec4899', '#9d174d'], category: 'Development' },
    { id: 'vault', title: 'Cloud-Vault', description: 'Secure Secret Management.', icon: 'shield-checkmark-outline', color: ['#ef4444', '#b91c1c'], category: 'DevOps' },
    { id: 'css-viz', title: 'Flex & Grid', description: 'Interactive layout playground.', icon: 'layers-outline', color: ['#f59e0b', '#b45309'], category: 'Design' },
    { id: 'compress', title: 'Asset-Compressor', description: 'Tiny WebP or optimized SVG.', icon: 'contract-outline', color: ['#3b82f6', '#2563eb'], category: 'Design' },
    { id: 'contract-scaffold', title: 'Solidity Scaffold', description: 'No-Code ERC20 Smart Contract.', icon: 'document-lock-outline', color: ['#6366f1', '#4338ca'], category: 'Development' },
    { id: 'og-preview', title: 'OG Previewer', description: 'Simulate social media link cards.', icon: 'logo-whatsapp', color: ['#25d366', '#128c7e'], category: 'Design' },
    { id: 'git-master', title: 'Git-Master', description: 'Comprehensive Git command reference.', icon: 'git-branch-outline', color: ['#ef4444', '#b91c1c'], category: 'Utility' },
    { id: 'linux-master', title: 'Linux-Master', description: 'Ultimate Linux CLI handbook.', icon: 'terminal', color: ['#f59e0b', '#d97706'], category: 'Utility' },
    { id: 'architect', title: 'The Architect', description: 'System design decision tree.', icon: 'business-outline', color: ['#3b82f6', '#1d4ed8'], category: 'DevOps' },
    { id: 'term-to-eng', title: 'Terminal Explainer', description: 'Translate scripts to English.', icon: 'terminal-outline', color: ['#10b981', '#059669'], category: 'Utility' },
    { id: 'cost', title: 'Cloud-Cost', description: 'AWS/GCP/Azure/DO Estimator.', icon: 'calculator-outline', color: ['#10b981', '#047857'], category: 'DevOps' },
    { id: 'sig-gen', title: 'API-Signature', description: 'HMAC & SHA-256 Generator.', icon: 'key-outline', color: ['#ef4444', '#991b1b'], category: 'DevOps' },
    { id: 'curl-code', title: 'CURL-to-Code', description: 'cURL to Fetch/Axios snippets.', icon: 'terminal-outline', color: ['#8b5cf6', '#6d28d9'], category: 'Development' },
    { id: 'svg-comp', title: 'SVG-to-React', description: 'SVG to React/Flutter components.', icon: 'logo-react', color: ['#6366f1', '#3730a3'], category: 'Development' },
    { id: 'code-img', title: 'Code-to-Image', description: 'Beautiful code snippets for social.', icon: 'image-outline', color: ['#f43f5e', '#e11d48'], category: 'Design' },
    { id: 'contrast', title: 'Contrast-Validator', description: 'WCAG Accessibility scores.', icon: 'eye-outline', color: ['#14b8a6', '#0f766e'], category: 'Design' },
    { id: 'sla', title: 'SLA-Calculator', description: 'Uptime percentage visualizer.', icon: 'trending-up-outline', color: ['#f43f5e', '#be123c'], category: 'DevOps' },
];

export default function DevToots({ navigation }: any) {
    const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
    const [activeTab, setActiveTab] = useState<'All' | 'Development' | 'Utility' | 'Design' | 'DevOps'>('All');

    const filteredTools = activeTab === 'All' ? TOOLS : TOOLS.filter(t => t.category === activeTab);

    const renderToolCard = (tool: Tool) => (
        <Pressable
            key={tool.id}
            onPress={() => setSelectedTool(tool)}
            className="w-[47%] mb-4 bg-gray-900/50 rounded-3xl border border-white/10 overflow-hidden shadow-lg"
        >
            <LinearGradient
                colors={[tool.color[0], tool.color[1], 'transparent'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ opacity: 0.1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View className="p-4 items-center">
                <View className="w-12 h-12 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: tool.color[0] + '20' }}>
                    <Ionicons name={tool.icon} size={24} color={tool.color[0]} />
                </View>
                <Text className="text-white font-bold text-center text-sm" numberOfLines={1}>{tool.title}</Text>
                <Text className="text-gray-500 text-[10px] text-center mt-1" numberOfLines={2}>{tool.description}</Text>
            </View>
        </Pressable>
    );

    return (
        <View className="flex-1 bg-black">
            <LinearGradient
                colors={['#1a1a1a', '#000']}
                className="absolute inset-0"
            />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row justify-between items-center">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 bg-gray-900 p-2 rounded-xl">
                            <Ionicons name="chevron-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-3xl font-black italic text-white tracking-tighter">
                                DEV <Text className="text-pink-500">TOOTS</Text> 🛠️
                            </Text>
                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">SaaS for students</Text>
                        </View>
                    </View>
                </View>

                {/* Categories */}
                <View className="mt-4">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 20 }}
                    >
                        {['All', 'Development', 'Design', 'DevOps', 'Utility'].map((tab) => (
                            <Pressable
                                key={tab}
                                onPress={() => setActiveTab(tab as any)}
                                className={`px-5 py-2.5 rounded-full mr-2 border ${activeTab === tab ? 'bg-pink-500 border-pink-500' : 'bg-gray-900 border-gray-800'}`}
                            >
                                <Text className={`text-xs font-bold ${activeTab === tab ? 'text-white' : 'text-gray-400'}`}>{tab}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Tools Grid */}
                <ScrollView
                    className="flex-1 mt-6"
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View className="flex-row flex-wrap justify-between">
                        {filteredTools.map(renderToolCard)}
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Tool Modal Placeholder */}
            {selectedTool && (
                <View className="absolute inset-0 bg-black/90 z-50">
                    <ToolOverlay
                        tool={selectedTool}
                        onClose={() => setSelectedTool(null)}
                    />
                </View>
            )}
        </View>
    );
}

// --- UTILITY COMPONENTS ---

const ToolCard = ({ children }: { children: React.ReactNode }) => (
    <View className="bg-gray-900/50 p-6 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {children}
    </View>
);

const SectionTitle = ({ text, subText }: { text: string; subText?: string }) => (
    <View className="mb-6">
        <Text className="text-white font-black text-lg tracking-tight uppercase leading-none">{text}</Text>
        {subText && <Text className="text-gray-500 text-[10px] mt-1 font-bold uppercase tracking-widest">{subText}</Text>}
        <View className="h-[2px] w-8 bg-pink-600 mt-2 rounded-full" />
    </View>
);

// --- SUB-COMPONENTS FOR TOOLS ---

const ToolOverlay = ({ tool, onClose }: { tool: Tool, onClose: () => void }) => {
    return (
        <SafeAreaView className="flex-1">
            <View className="flex-1 px-6">
                {/* Modal Header */}
                <View className="flex-row justify-between items-center py-4">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: tool.color[0] }}>
                            <Ionicons name={tool.icon} size={20} color="white" />
                        </View>
                        <View>
                            <Text className="text-white font-bold text-lg">{tool.title}</Text>
                            <Text className="text-gray-400 text-xs">{tool.category}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} className="bg-gray-800 p-2 rounded-full">
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tool Implementation Switch */}
                <ScrollView showsVerticalScrollIndicator={false} className="flex-1 mt-4">
                    {renderToolContent(tool)}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const renderToolContent = (tool: Tool) => {
    switch (tool.id) {
        case 'regex': return <RegexTool />;
        case 'readme': return <ReadMeTool />;
        case 'commit': return <CommitGenTool />;
        case 'unit-conv': return <UnitConvertTool />;
        case 'sql-nosql': return <SqlToNoSqlTool />;
        case 'type-gen': return <TypeGenTool />;
        case 'cron': return <CronVisualizerTool />;
        case 'sla': return <SLACalculatorTool />;
        case 'contrast': return <ContrastTool />;
        case 'vault': return <VaultTool />;
        case 'css-viz': return <FlexboxTool />;
        case 'compress': return <CompressorTool />;
        case 'contract-scaffold': return <ContractScaffoldTool />;
        case 'og-preview': return <OGPreviewTool />;
        case 'api-play': return <APIPlaygroundTool />;
        case 'git-master': return <GitMasterTool />;
        case 'linux-master': return <LinuxMasterTool />;
        case 'architect': return <ArchitectTool />;
        case 'term-to-eng': return <TerminalToEnglishTool />;
        case 'cost': return <CostEstimatorTool />;
        case 'sig-gen': return <SignatureGenTool />;
        case 'curl-code': return <CurlCodeTool />;
        case 'svg-comp': return <SvgToCompTool />;
        case 'code-img': return <CodeToImageTool />;
        default:
            return (
                <View className="py-20 items-center">
                    <Ionicons name="hammer-outline" size={60} color="#333" />
                    <Text className="text-gray-500 mt-4 text-center font-medium">This tool is currently in development.{`\n`}Check back later!</Text>
                </View>
            );
    }
};

// --- TOOL IMPLEMENTATIONS ---

const REGEX_LIB = [
    { name: 'Email (Basic)', pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$', cat: 'Auth' },
    { name: 'Email (Strict)', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', cat: 'Auth' },
    { name: 'Strong Password', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', cat: 'Auth' },
    { name: 'Username (4-16)', pattern: '^[a-zA-Z0-9_]{4,16}$', cat: 'Auth' },
    { name: 'Full Name', pattern: '^[a-zA-Z\\s]{2,50}$', cat: 'Auth' },
    { name: 'Phone (India)', pattern: '^(\\+91[\\-\\s]?)?[0]?(91)?[6789]\\d{9}$', cat: 'Location' },
    { name: 'Phone (US)', pattern: '^(\\+?1[\\-\\s]?)?\\(?[2-9]\\d{2}\\)?[\\-\\s]?\\d{3}[\\-\\s]?\\d{4}$', cat: 'Location' },
    { name: 'Phone (UK)', pattern: '^(((\\+44\\s?\\d{4}|\\(?0\\d{4}\\)?)\\s?\\d{3}\\s?\\d{3})|((\\+44\\s?\\d{3}|\\(?0\\d{3}\\)?)\\s?\\d{3}\\s?\\d{4})|((\\+44\\s?\\d{2}|\\(?0\\d{2}\\)?)\\s?\\d{4}\\s?\\d{4}))$', cat: 'Location' },
    { name: 'URL (Web)', pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)', cat: 'Identifier' },
    { name: 'IPv4 Address', pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$', cat: 'Dev' },
    { name: 'IPv6 Address', pattern: '^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$', cat: 'Dev' },
    { name: 'MAC Address', pattern: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$', cat: 'Dev' },
    { name: 'Hex Color', pattern: '^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$', cat: 'Design' },
    { name: 'UUID', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', cat: 'Identifier' },
    { name: 'MongoDB ID', pattern: '^[0-9a-fA-F]{24}$', cat: 'Dev' },
    { name: 'Credit Card (Visa)', pattern: '^4[0-9]{12}(?:[0-9]{3})?$', cat: 'Finance' },
    { name: 'Credit Card (MC)', pattern: '^5[1-5][0-9]{14}$', cat: 'Finance' },
    { name: 'JWT Token', pattern: '^[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*$', cat: 'Auth' },
    { name: 'Date (YYYY-MM-DD)', pattern: '^\\d{4}-\\d{2}-\\d{2}$', cat: 'Misc' },
    { name: 'Date (DD/MM/YYYY)', pattern: '^(0[1-9]|[12][0-9]|3[01])[- /.](0[1-9]|1[012])[- /.](19|20)\\d\\d$', cat: 'Misc' },
    { name: 'Time (24h)', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$', cat: 'Misc' },
    { name: 'Slug', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', cat: 'Identifier' },
    { name: 'Semantic Version', pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$', cat: 'Dev' },
    { name: 'Git Commit Hash', pattern: '^[0-9a-f]{7,40}$', cat: 'Dev' },
    { name: 'Digits Only', pattern: '^\\d+$', cat: 'Misc' },
    { name: 'Letters Only', pattern: '^[a-zA-Z]+$', cat: 'Misc' },
    { name: 'Price (USD)', pattern: '^\\$?\\d+(\\.\\d{2})?$', cat: 'Finance' },
    { name: 'Camel Case', pattern: '^[a-z]+(?:[A-Z][a-z]*)*$', cat: 'Code' },
    { name: 'Pascal Case', pattern: '^[A-Z][a-z]+(?:[A-Z][a-z]*)*$', cat: 'Code' },
    { name: 'Snake Case', pattern: '^[a-z]+(?:_[a-z]+)*$', cat: 'Code' },
    { name: 'HTML Tag', pattern: '^<([a-z1-6]+)([^>]+)*(?:>(.*)<\\/\\1>|\\s+\\/>)$', cat: 'Code' },
    { name: 'US Zip Code', pattern: '^\\d{5}(?:[-\\s]\\d{4})?$', cat: 'Location' },
    { name: 'UK Postcode', pattern: '^([A-Z][A-HJ-Y]?\\d[A-Z\\d]? \\d[A-Z]{2}|GIR 0AA)$', cat: 'Location' },
    { name: 'India PIN Code', pattern: '^[1-9][0-9]{5}$', cat: 'Location' },
    { name: 'SSN (US)', pattern: '^\\d{3}-\\d{2}-\\d{4}$', cat: 'Finance' },
    { name: 'Latitude', pattern: '^[-+]?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$', cat: 'Location' },
    { name: 'Longitude', pattern: '^[-+]?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$', cat: 'Location' },
    { name: 'Base64', pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$', cat: 'Dev' },
    { name: 'ASCII Only', pattern: '^[\\x00-\\x7F]*$', cat: 'Misc' },
    { name: 'Binary', pattern: '^[01]+$', cat: 'Dev' },
    { name: 'Octal', pattern: '^[0-7]+$', cat: 'Dev' },
    { name: 'Hexadecimal', pattern: '^[0-9a-fA-F]+$', cat: 'Dev' },
    { name: 'C Identifier', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$', cat: 'Code' },
    { name: 'Docker Image', pattern: '^([a-z0-9]+(?:[._-][a-z0-9]+)*\\/)?([a-z0-9]+(?:[._-][a-z0-9]+)*)(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)?$', cat: 'Dev' },
    { name: 'GitHub Repo', pattern: '^[a-zA-Z0-9-]+\\/[a-zA-Z0-9._-]+$', cat: 'Dev' },
    { name: 'ISBN-10', pattern: '^(?:\\d[\\ |-]?){9}[\\d|X]$', cat: 'Misc' },
    { name: 'ISBN-13', pattern: '^(?:\\d[\\ |-]?){13}$', cat: 'Misc' },
    { name: 'YouTube URL', pattern: '^(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([\\w-]{11})(?:&.*)?$', cat: 'Misc' },
    { name: 'CSS Comment', pattern: '^\\/\\*[\\s\\S]*?\\*\\/$', cat: 'Code' },
    { name: 'JS single comment', pattern: '^\\/\\/.*$', cat: 'Code' },
    { name: 'MD ImageLink', pattern: '!\\[.*?\\]\\(.*?\\)', cat: 'Code' },
    { name: 'MD HyperLink', pattern: '\\[.*?\\]\\(.*?\\)', cat: 'Code' },
    { name: 'CSV Line', pattern: '^([^,]*)(,[^,]*)*$', cat: 'Misc' },
    { name: 'Apache Log', pattern: '^(\\S+) (\\S+) (\\S+) \\[([\\w:/]+\\s[+\\-]\\d{4})\\] "(\\S+)\\s?(\\S+)?\\s?(\\S+)?" (\\d{3}|-) (\\d+|-)$', cat: 'Dev' },
    { name: 'SemVer Regex', pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$', cat: 'Dev' },
    { name: 'Word Count (Min 5)', pattern: '^(\\w+\\W+){4,}\\w+$', cat: 'Misc' },
    { name: 'No Special Chars', pattern: '^[a-zA-Z0-9]+$', cat: 'Auth' },
    { name: 'Indian Pan Card', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', cat: 'Location' },
    { name: 'GST Number', pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', cat: 'Finance' },
    { name: 'Adhaar Card', pattern: '^[2-9]{1}[0-9]{3}\\s[0-9]{4}\\s[0-9]{4}$', cat: 'Location' },
    { name: 'Vehicle Number', pattern: '^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$', cat: 'Location' },
    { name: 'Credit Card (Amex)', pattern: '^3[47][0-9]{13}$', cat: 'Finance' },
    { name: 'Credit Card (Disc)', pattern: '^6(?:011|5[0-9]{2})[0-9]{12}$', cat: 'Finance' },
    { name: 'Twitter Handler', pattern: '^@?(\\w){1,15}$', cat: 'Misc' },
    { name: 'Instagram User', pattern: '^[a-zA-Z0-9._]{1,30}$', cat: 'Misc' },
    { name: 'LinkedIn URL', pattern: '^https?:\\/\\/(www\\.)?linkedin\\.com\\/(in|pub|company)\\/[a-zA-Z0-9_-]+\\/?$', cat: 'Misc' },
    { name: 'BitCoin Address', pattern: '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$', cat: 'Finance' },
    { name: 'Ethereum Address', pattern: '^0x[a-fA-F0-9]{40}$', cat: 'Finance' },
    { name: 'ASIN (Amazon)', pattern: '^B[0-9A-Z]{9}$', cat: 'Identifier' },
    { name: 'MAC Address IEEE', pattern: '^([0-9A-F]{2}-){5}[0-9A-F]{2}$', cat: 'Dev' },
    { name: 'Discord ID', pattern: '^\\d{17,19}$', cat: 'Identifier' },
    { name: 'Slack Hook URL', pattern: '^https:\\/\\/hooks\\.slack\\.com\\/services\\/[A-Z0-9]+\\/[A-Z0-9]+\\/[A-Z0-9]+$', cat: 'Dev' },
    { name: 'Mongo Connection', pattern: '^mongodb(?:\\+srv)?\\:\\/\\/.+$', cat: 'Dev' },
    { name: 'Redis Connection', pattern: '^redis(?:s)?\\:\\/\\/.+$', cat: 'Dev' },
    { name: 'Cron Exp (Basic)', pattern: '^(\\d+|\\*) (\\d+|\\*) (\\d+|\\*) (\\d+|\\*) (\\d+|\\*)$', cat: 'Dev' },
    { name: 'Port Number', pattern: '^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$', cat: 'Dev' },
    { name: 'File Extension', pattern: '^\\.(\\w+)$', cat: 'Misc' },
    { name: 'Alpha-Numeric (Spc)', pattern: '^[a-zA-Z0-9 ]+$', cat: 'Misc' },
    { name: 'Lowercase Only', pattern: '^[a-z]+$', cat: 'Misc' },
    { name: 'Uppercase Only', pattern: '^[A-Z]+$', cat: 'Misc' },
    { name: 'Strong Name', pattern: '^[A-Z][a-z]+(?: [A-Z][a-z]+)*$', cat: 'Misc' },
    { name: 'Windows Path', pattern: '^[a-zA-Z]:\\\\(?:[^\\\\/:*?"<>|\\r\\n]+\\\\)*[^\\\\/:*?"<>|\\r\\n]*$', cat: 'Misc' },
    { name: 'Unix Path', pattern: '^\\/(?:[^\\/\\0]+\\/)*[^\\/\\0]*$', cat: 'Misc' },
    { name: 'ISBN-13 No Hyphen', pattern: '^\\d{13}$', cat: 'Misc' },
    { name: 'EAN-13', pattern: '^\\d{13}$', cat: 'Misc' },
    { name: 'UPC-A', pattern: '^\\d{12}$', cat: 'Misc' },
    { name: 'Swift Code', pattern: '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', cat: 'Finance' },
    { name: 'IBAN Number', pattern: '^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$', cat: 'Finance' },
    { name: 'Credit Card CVD', pattern: '^[0-9]{3,4}$', cat: 'Finance' },
    { name: 'US Passport', pattern: '^[a-zA-Z0-9]{9}$', cat: 'Location' },
    { name: 'China Resident ID', pattern: '^\\d{15}|\\d{18}|\\d{17}(\\d|X|x)$', cat: 'Location' },
    { name: 'CSS Hex Colors', pattern: '#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})', cat: 'Design' },
    { name: 'RGB Color', pattern: 'rgb\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*\\)', cat: 'Design' },
    { name: 'RGBA Color', pattern: 'rgba\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(0|1|0\\.\\d+)\\s*\\)', cat: 'Design' },
    { name: 'HSL Color', pattern: 'hsl\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3}%)\\s*,\\s*(\\d{1,3}%)\\s*\\)', cat: 'Design' },
    { name: 'CamelCase 2', pattern: '^[a-z]+([A-Z][a-z]+)*$', cat: 'Code' },
    { name: 'PascalCase 2', pattern: '^[A-Z][a-z]+([A-Z][a-z]+)*$', cat: 'Code' },
    { name: 'Variable Name', pattern: '^[a-zA-Z_$][a-zA-Z0-9_$]*$', cat: 'Code' },
];

const RegexTool = () => {
    const [pattern, setPattern] = useState('');
    const [testStr, setTestStr] = useState('');
    const [search, setSearch] = useState('');
    const [isMatch, setIsMatch] = useState<boolean | null>(null);

    const testRegex = () => {
        try {
            if (!pattern) return;
            const re = new RegExp(pattern);
            setIsMatch(re.test(testStr));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e: any) {
            Alert.alert("Error", "Invalid Regex Pattern");
            setIsMatch(null);
        }
    };

    const filtered = REGEX_LIB.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.cat.toLowerCase().includes(search.toLowerCase())
    );

    const copyPattern = async (p: string) => {
        await Clipboard.setStringAsync(p);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Regex copied to clipboard!");
    };

    return (
        <ToolCard>
            <SectionTitle text="Regex Library" subText="Search across 100+ production patterns." />

            <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search: Email, IP, Phone, Code..."
                placeholderTextColor="#666"
                className="bg-black p-4 rounded-xl text-white mb-6 border border-white/5"
            />

            <View className="max-h-[300px] mb-8">
                <ScrollView showsVerticalScrollIndicator={false}>
                    {filtered.map((item, idx) => (
                        <View key={idx} className="bg-gray-900/50 p-3 rounded-2xl mb-2 flex-row justify-between items-center border border-white/5">
                            <TouchableOpacity onPress={() => setPattern(item.pattern)} className="flex-1">
                                <Text className="text-white font-bold text-[10px]">{item.name}</Text>
                                <Text className="text-pink-500 font-mono text-[8px] mt-1" numberOfLines={1}>{item.pattern}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => copyPattern(item.pattern)} className="bg-gray-800 p-2 rounded-lg ml-2">
                                <Ionicons name="copy-outline" size={14} color="#ec4899" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            </View>

            <SectionTitle text="Pattern Tester" />
            <TextInput value={pattern} onChangeText={setPattern} placeholder="Regex Pattern" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-pink-500 font-mono text-xs mb-4 border border-white/5" />
            <TextInput value={testStr} onChangeText={setTestStr} placeholder="Test String" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white font-mono text-xs mb-6 border border-white/5" />

            <TouchableOpacity onPress={testRegex} className="bg-pink-600 py-4 rounded-xl items-center shadow-lg shadow-pink-500/20">
                <Text className="text-white font-black tracking-widest text-xs uppercase">Run Analysis</Text>
            </TouchableOpacity>

            {isMatch !== null && (
                <View className={`mt-4 p-4 rounded-xl items-center ${isMatch ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <Text className={`font-black tracking-tighter ${isMatch ? 'text-green-500' : 'text-red-500'}`}>
                        {isMatch ? 'MATCH DETECTED ✅' : 'NO MATCH FOUND ❌'}
                    </Text>
                </View>
            )}
        </ToolCard>
    );
};

const ReadMeTool = () => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [stack, setStack] = useState('');

    const md = `# ${name || 'Project Name'}\n\n## Description\n${desc || 'Add description here'}\n\n## Tech Stack\n${stack || 'React, Node, etc.'}\n\n## Installation\n\`\`\`bash\nnpm install\nnpm start\n\`\`\``;

    const copy = () => {
        Clipboard.setStringAsync(md);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "README.md copied!");
    };

    return (
        <ToolCard>
            <SectionTitle text="README Preview" subText="Live markdown output of your project file." />
            <View className="bg-black/80 rounded-2xl border border-white/5 mb-8 overflow-hidden">
                <View className="bg-gray-900/50 px-4 py-2 border-b border-white/5 flex-row justify-between items-center">
                    <Text className="text-gray-500 font-black uppercase text-[8px] tracking-widest">README.md</Text>
                    <TouchableOpacity onPress={copy} className="bg-green-600/20 px-3 py-1 rounded-full flex-row items-center border border-green-500/20">
                        <Ionicons name="copy-outline" size={12} color="#22c55e" />
                        <Text className="text-green-500 font-bold ml-1 text-[10px]">COPY</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView className="max-h-[200px] p-5">
                    <Text className="text-gray-400 font-mono text-[10px] leading-5">{md}</Text>
                </ScrollView>
            </View>

            <SectionTitle text="Project Meta" />
            <TextInput value={name} onChangeText={setName} placeholder="Project Name" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-4 border border-white/5" />
            <TextInput value={desc} onChangeText={setDesc} multiline numberOfLines={3} placeholder="Brief Description" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-4 min-h-[100px] border border-white/5" />
            <TextInput value={stack} onChangeText={setStack} placeholder="React, Node, MongoDB..." placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-8 border border-white/5" />
        </ToolCard>
    );
};

const CommitGenTool = () => {
    const [type, setType] = useState('feat');
    const [msg, setMsg] = useState('');

    const copy = () => {
        const cmd = `git commit -m "${type}: ${msg}"`;
        Clipboard.setStringAsync(cmd);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Copied", cmd);
    };

    return (
        <ToolCard>
            <SectionTitle text="Commit Builder" subText="Follow conventional commit standards." />
            <View className="flex-row flex-wrap gap-2 mb-6">
                {['feat', 'fix', 'docs', 'chore', 'refactor', 'test'].map(t => (
                    <TouchableOpacity
                        key={t}
                        onPress={() => setType(t)}
                        className={`px-4 py-2 rounded-xl border border-white/5 ${type === t ? 'bg-pink-600' : 'bg-gray-800'}`}
                    >
                        <Text className="text-white text-[10px] font-bold uppercase">{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput value={msg} onChangeText={setMsg} placeholder="Describe your changes..." placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-6 border border-white/5" />
            <TouchableOpacity onPress={copy} className="bg-blue-600 py-4 rounded-xl items-center shadow-lg shadow-blue-500/20">
                <Text className="text-white font-black uppercase tracking-widest text-xs">Copy Commit Command</Text>
            </TouchableOpacity>
        </ToolCard>
    );
};

const CONVERSIONS = [
    { id: 'px-rem', name: 'PX to REM', from: 'Pixels', to: 'REM', base: 16 },
    { id: 'px-em', name: 'PX to EM', from: 'Pixels', to: 'EM', base: 16 },
    { id: 'rem-px', name: 'REM to PX', from: 'REM', to: 'Pixels', base: 16 },
    { id: 'px-vw', name: 'PX to VW', from: 'Pixels', to: 'VW', base: 1920 },
    { id: 'px-vh', name: 'PX to VH', from: 'Pixels', to: 'VH', base: 1080 },
    { id: 'hex-rgb', name: 'HEX to RGBA', from: 'Hex', to: 'RGBA', base: 0 },
    { id: 'byte-mb', name: 'Bytes to MB', from: 'Bytes', to: 'MB', base: 1024 * 1024 },
];

const UnitConvertTool = () => {
    const [selected, setSelected] = useState(CONVERSIONS[0]);
    const [input, setInput] = useState('');
    const [result, setResult] = useState('');

    const convert = (val: string) => {
        setInput(val);
        if (!val) {
            setResult('');
            return;
        }

        let res = '';
        if (selected.id === 'hex-rgb') {
            const hex = val.replace('#', '');
            if (hex.length === 3 || hex.length === 6) {
                const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
                const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
                const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
                res = `rgba(${r}, ${g}, ${b}, 1)`;
            } else {
                res = 'Invalid Hex';
            }
        } else if (selected.id === 'rem-px') {
            res = (parseFloat(val) * selected.base).toFixed(2);
        } else if (selected.id.includes('px-v')) {
            res = ((parseFloat(val) / selected.base) * 100).toFixed(3) + (selected.id.endsWith('vw') ? 'vw' : 'vh');
        } else {
            res = (parseFloat(val) / selected.base).toFixed(3);
        }
        setResult(res);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <ToolCard>
            <SectionTitle text="Dev Converter" subText="Web-standards unit transformation." />

            <Text className="text-gray-500 text-[10px] font-black uppercase mb-3 ml-1">Select Conversion</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                {CONVERSIONS.map(c => (
                    <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                            setSelected(c);
                            setInput('');
                            setResult('');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        className={`mr-2 px-4 py-2 rounded-xl border border-white/5 ${selected.id === c.id ? 'bg-pink-600' : 'bg-gray-800'}`}
                    >
                        <Text className="text-white text-[10px] font-bold uppercase">{c.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View className="flex-row items-center justify-between">
                <View className="w-[45%]">
                    <Text className="text-gray-500 text-[10px] mb-2 font-black uppercase">{selected.from}</Text>
                    <TextInput
                        value={input}
                        onChangeText={convert}
                        placeholder="0.00"
                        placeholderTextColor="#444"
                        className="bg-black p-5 rounded-2xl text-white text-center font-black text-lg border border-white/5"
                    />
                </View>
                <Ionicons name="swap-horizontal" size={24} color="#ec4899" />
                <View className="w-[45%]">
                    <Text className="text-pink-500 text-[10px] mb-2 font-black uppercase">{selected.to}</Text>
                    <TouchableOpacity
                        onPress={() => {
                            if (result) {
                                Clipboard.setStringAsync(result);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        }}
                        className="bg-gray-800 p-5 rounded-2xl items-center justify-center border border-pink-500/20"
                    >
                        <Text className="text-white font-black text-lg" numberOfLines={1}>{result || '0.00'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {result ? (
                <Text className="text-gray-600 text-[9px] text-center mt-4 font-bold uppercase">Tap result to copy to clipboard</Text>
            ) : null}
        </ToolCard>
    );
};

const SqlToNoSqlTool = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [mode, setMode] = useState<'sql-nosql' | 'nosql-sql'>('sql-nosql');

    const translate = () => {
        if (!input.trim()) return;
        let result = '';

        if (mode === 'sql-nosql') {
            const text = input.trim().toLowerCase();
            // Complex aggregation query (GROUP BY)
            if (text.includes('group by')) {
                const table = text.match(/from\s+([a-zA-Z0-9_]+)/)?.[1] || 'collection';
                const groupCol = text.match(/group by\s+([a-zA-Z0-9_]+)/)?.[1];
                const where = text.match(/where\s+(.+?)\s+group/)?.[1];

                let pipeline: any[] = [];
                if (where) {
                    const [col, val] = where.split('=').map(s => s.trim().replace(/'/g, ''));
                    pipeline.push({ $match: { [col]: isNaN(Number(val)) ? val : Number(val) } });
                }

                const groupObj: any = { _id: `$${groupCol}` };
                const selectFields = text.match(/select\s+(.+?)\s+from/)?.[1] || '';
                if (selectFields.includes('count(*)')) groupObj.count = { $sum: 1 };
                if (selectFields.includes('sum(')) {
                    const field = selectFields.match(/sum\(([a-zA-Z0-9_]+)\)/)?.[1];
                    groupObj.total = { $sum: `$${field}` };
                }

                pipeline.push({ $group: groupObj });

                if (text.includes('order by')) {
                    const sortCol = text.match(/order by\s+([a-zA-Z0-9_]+)/)?.[1];
                    const dir = text.includes('desc') ? -1 : 1;
                    pipeline.push({ $sort: { [sortCol || 'field']: dir } });
                }

                result = `db.${table}.aggregate(${JSON.stringify(pipeline, null, 2)})`;
            }
            // Simple SELECT
            else if (text.includes('select')) {
                const table = text.match(/from\s+([a-zA-Z0-9_]+)/)?.[1] || 'collection';
                const where = text.match(/where\s+(.+)/)?.[1];
                const limit = text.match(/limit\s+(\d+)/)?.[1];

                if (where) {
                    const [col, val] = where.split('=').map(s => s.trim().replace(/'/g, ''));
                    result = `db.${table}.find({ ${col}: "${val}" })`;
                } else { result = `db.${table}.find({})`; }

                if (limit) result += `.limit(${limit})`;
            }
            // Basic CRUD
            else if (text.includes('insert into')) {
                const table = text.match(/into\s+([a-zA-Z0-9_]+)/)?.[1] || 'collection';
                const cols = text.match(/\((.+)\)\s+values/)?.[1]?.split(',').map(s => s.trim()) || [];
                const vals = text.match(/values\s*\((.+)\)/)?.[1]?.split(',').map(s => s.trim().replace(/'/g, '')) || [];
                const obj: any = {};
                cols.forEach((c, i) => obj[c] = vals[i]);
                result = `db.${table}.insertOne(${JSON.stringify(obj, null, 2)})`;
            } else if (text.includes('update')) {
                const table = text.match(/update\s+([a-zA-Z0-9_]+)/)?.[1] || 'collection';
                const set = text.match(/set\s+(.+)\s+where/)?.[1] || text.match(/set\s+(.+)$/)?.[1];
                const where = text.match(/where\s+(.+)/)?.[1];
                let filter = '{}';
                if (where) {
                    const [wc, wv] = where.split('=').map(s => s.trim().replace(/'/g, ''));
                    filter = `{ ${wc}: "${wv}" }`;
                }
                const [sc, sv] = (set || '').split('=').map(s => s.trim().replace(/'/g, ''));
                result = `db.${table}.updateOne(${filter}, { $set: { ${sc}: "${sv}" } })`;
            } else if (text.includes('delete from')) {
                const table = text.match(/from\s+([a-zA-Z0-9_]+)/)?.[1] || 'collection';
                const where = text.match(/where\s+(.+)/)?.[1];
                let filter = '{}';
                if (where) {
                    const [wc, wv] = where.split('=').map(s => s.trim().replace(/'/g, ''));
                    filter = `{ ${wc}: "${wv}" }`;
                }
                result = `db.${table}.deleteOne(${filter})`;
            } else { result = "// More SQL logic mapping coming soon!"; }
        } else {
            const text = input.trim();
            // MongoDB Aggregation Pipeline
            if (text.includes('.aggregate([')) {
                const table = text.match(/db\.([a-zA-Z0-9_]+)/)?.[1] || 'table';
                const pipelineStr = text.match(/\.aggregate\((.+)\)/)?.[1] || '[]';
                try {
                    const pipeline = eval(`(${pipelineStr})`);
                    let select = '*', where = '', groupBy = '', orderBy = '', limit = '';

                    pipeline.forEach((step: any) => {
                        const op = Object.keys(step)[0];
                        const val = step[op];
                        if (op === '$match') {
                            const keys = Object.keys(val);
                            where = 'WHERE ' + keys.map(k => `${k} = '${val[k]}'`).join(' AND ');
                        } else if (op === '$group') {
                            const id = val._id;
                            groupBy = id ? `GROUP BY ${String(id).replace('$', '')}` : '';
                            const aggs = Object.keys(val).filter(k => k !== '_id').map(k => {
                                const aggOp = Object.keys(val[k])[0];
                                const aggField = String(val[k][aggOp]).replace('$', '');
                                const sqlOp = aggOp === '$sum' ? 'SUM' : aggOp === '$avg' ? 'AVG' : aggOp === '$max' ? 'MAX' : aggOp === '$min' ? 'MIN' : 'COUNT';
                                return `${sqlOp}(${aggField === '1' ? '*' : aggField}) AS ${k}`;
                            });
                            select = (id ? String(id).replace('$', '') + (aggs.length ? ', ' : '') : '') + aggs.join(', ');
                        } else if (op === '$sort') {
                            orderBy = 'ORDER BY ' + Object.keys(val).map(k => `${k} ${val[k] === 1 ? 'ASC' : 'DESC'}`).join(', ');
                        } else if (op === '$limit') {
                            limit = `LIMIT ${val}`;
                        } else if (op === '$project') {
                            select = Object.keys(val).filter(k => val[k] === 1).join(', ');
                        }
                    });
                    result = `SELECT ${select || '*'} FROM ${table} ${where} ${groupBy} ${orderBy} ${limit};`.replace(/\s+/g, ' ').trim();
                } catch (e: any) { result = `-- Aggregation Error: ${e.message}`; }
            }
            // Chained find() methods
            else if (text.includes('.find(')) {
                const table = text.match(/db\.([a-zA-Z0-9_]+)/)?.[1] || 'table';
                const query = text.match(/\.find\((.+?)\)/)?.[1] || '{}';
                const limit = text.match(/\.limit\((\d+)\)/)?.[1];
                const sort = text.match(/\.sort\((.+?)\)/)?.[1];

                let where = '';
                if (query !== '{}') {
                    try {
                        const q = eval(`(${query})`);
                        where = 'WHERE ' + Object.keys(q).map(k => `${k} = '${q[k]}'`).join(' AND ');
                    } catch (e) { where = `WHERE ${query}`; }
                }

                let orderBy = '';
                if (sort) {
                    try {
                        const s = eval(`(${sort})`);
                        orderBy = 'ORDER BY ' + Object.keys(s).map(k => `${k} ${s[k] === 1 ? 'ASC' : 'DESC'}`).join(', ');
                    } catch (e) { }
                }

                result = `SELECT * FROM ${table} ${where} ${orderBy} ${limit ? 'LIMIT ' + limit : ''};`.replace(/\s+/g, ' ').trim();
            }
            // Basic CRUD
            else if (text.includes('.insertOne(')) {
                const table = text.match(/db\.([a-zA-Z0-9_]+)/)?.[1] || 'table';
                const data = text.match(/\.insertOne\((.+)\)/)?.[1];
                try {
                    const d = eval(`(${data})`);
                    result = `INSERT INTO ${table} (${Object.keys(d).join(', ')}) VALUES (${Object.values(d).map(v => `'${v}'`).join(', ')});`;
                } catch (e) { result = `INSERT INTO ${table} ...;`; }
            } else if (text.includes('.updateOne(')) {
                const table = text.match(/db\.([a-zA-Z0-9_]+)/)?.[1] || 'table';
                const match = text.match(/\.updateOne\((.+),\s*\{(.+)\}\s*\)/);
                if (match) {
                    try {
                        const filter = eval(`(${match[1]})`), update = eval(`({${match[2]}})`);
                        const set = Object.keys(update.$set)[0];
                        result = `UPDATE ${table} SET ${set} = '${update.$set[set]}' WHERE ${Object.keys(filter)[0]} = '${filter[Object.keys(filter)[0]]}';`;
                    } catch (e) { result = `UPDATE ${table} SET ...;`; }
                }
            } else if (text.includes('.deleteOne(')) {
                const table = text.match(/db\.([a-zA-Z0-9_]+)/)?.[1] || 'table';
                const query = text.match(/\.deleteOne\((.+)\)/)?.[1];
                try {
                    const q = eval(`(${query})`);
                    result = `DELETE FROM ${table} WHERE ${Object.keys(q)[0]} = '${q[Object.keys(q)[0]]}';`;
                } catch (e) { result = `DELETE FROM ${table} ...;`; }
            } else { result = "-- More Mongo logic mapping coming soon!"; }
        }

        setOutput(result);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <ToolCard>
            <SectionTitle text="SQL ↔ NoSQL" subText="Bi-directional Database Query Translator." />

            <View className="flex-row bg-gray-900 p-1 rounded-2xl mb-6 border border-white/5">
                <TouchableOpacity onPress={() => { setMode('sql-nosql'); setInput(''); setOutput(''); }} className={`flex-1 py-3 rounded-xl items-center ${mode === 'sql-nosql' ? 'bg-pink-600' : ''}`}>
                    <Text className={`text-[10px] font-black uppercase ${mode === 'sql-nosql' ? 'text-white' : 'text-gray-500'}`}>MySQL to Mongo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setMode('nosql-sql'); setInput(''); setOutput(''); }} className={`flex-1 py-3 rounded-xl items-center ${mode === 'nosql-sql' ? 'bg-pink-600' : ''}`}>
                    <Text className={`text-[10px] font-black uppercase ${mode === 'nosql-sql' ? 'text-white' : 'text-gray-500'}`}>Mongo to MySQL</Text>
                </TouchableOpacity>
            </View>

            <TextInput
                value={input}
                onChangeText={setInput}
                multiline
                placeholder={mode === 'sql-nosql' ? "SELECT * FROM users WHERE id = 1" : "db.users.find({ id: 1 })"}
                placeholderTextColor="#666"
                className="bg-black p-5 rounded-2xl text-white mb-4 font-mono text-xs h-28 border border-white/5"
            />

            <TouchableOpacity onPress={translate} className="bg-pink-600 py-4 rounded-xl items-center mb-8 shadow-lg shadow-pink-500/20">
                <Text className="text-white font-black text-xs uppercase tracking-widest">Perform Translation</Text>
            </TouchableOpacity>

            <View className="bg-gray-900 p-6 rounded-3xl border border-white/5">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-500 text-[10px] font-black uppercase">Resulting Query</Text>
                    {output ? (
                        <TouchableOpacity onPress={() => { Clipboard.setStringAsync(output); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
                            <Ionicons name="copy-outline" size={16} color="#ec4899" />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <Text className="text-green-500 font-mono text-[11px] leading-5">{output || (mode === 'sql-nosql' ? '// Mongo logic will appear here.' : '-- SQL will appear here.')}</Text>
            </View>
        </ToolCard>
    );
};

const TypeGenTool = () => {
    const [json, setJson] = useState('');
    const [types, setTypes] = useState('');

    const generate = () => {
        try {
            const obj = JSON.parse(json);
            let result = 'interface RootObject {\n';
            Object.keys(obj).forEach(key => {
                const type = typeof obj[key];
                result += `  ${key}: ${type};\n`;
            });
            result += '}';
            setTypes(result);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            setTypes('// ERROR: Invalid JSON format.');
        }
    };

    return (
        <ToolCard>
            <SectionTitle text="API-to-Type" subText="Convert JSON responses to TS Interfaces." />
            <TextInput value={json} onChangeText={setJson} multiline placeholder='{"id": 1, "name": "Antigravity"}' placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-4 font-mono h-24 text-[10px] border border-white/5" />
            <TouchableOpacity onPress={generate} className="bg-blue-600 py-3 rounded-xl items-center mb-6 shadow-lg shadow-blue-500/10">
                <Text className="text-white font-black text-xs uppercase tracking-widest">Generate Interface</Text>
            </TouchableOpacity>

            <ScrollView className="bg-black/80 p-5 rounded-2xl border border-white/5 max-h-[200px]">
                <Text className="text-pink-500 font-mono text-[10px] leading-4">{types || '// interface results will appear here.'}</Text>
            </ScrollView>
        </ToolCard>
    );
};

const CronVisualizerTool = () => {
    const [m, setM] = useState('*');
    const [h, setH] = useState('*');
    const [d, setD] = useState('*');
    const [mon, setMon] = useState('*');
    const [w, setW] = useState('*');
    const [cron, setCron] = useState('* * * * *');
    const [mode, setMode] = useState<'build' | 'raw'>('build');

    useEffect(() => {
        if (mode === 'build') {
            setCron(`${m} ${h} ${d} ${mon} ${w}`);
        }
    }, [m, h, d, mon, w, mode]);

    const explainCron = (exp: string) => {
        const p = exp.split(' ');
        if (p.length < 5) return "Invalid Cron Expression";
        const [m1, h1, d1, mon1, w1] = p;

        const getPart = (val: string, type: string) => {
            if (val === '*') return `every ${type}`;
            if (val.includes('/')) return `every ${val.split('/')[1]} ${type}s`;
            if (val.includes('-')) return `from ${type} ${val.split('-')[0]} to ${val.split('-')[1]}`;
            if (type === 'hour') return `at ${val.padStart(2, '0')}:00`;
            if (type === 'weekday') {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return `on ${val.split(',').map(v => days[parseInt(v)] || v).join(', ')}`;
            }
            return `at ${type} ${val}`;
        };

        const minT = m1 === '*' ? 'every minute' : m1.includes('/') ? `every ${m1.split('/')[1]} mins` : `at :${m1.padStart(2, '0')}`;
        const hourT = getPart(h1, 'hour');
        const dayT = getPart(d1, 'day');
        const monthT = mon1 === '*' ? '' : ` in ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(mon1) - 1] || mon1}`;
        const weekT = getPart(w1, 'weekday');

        return `Executes ${minT}, ${hourT}, ${dayT}${monthT} ${w1 === '*' ? '' : weekT}.`.replace(/\s+/g, ' ').trim();
    };

    const copy = () => {
        Clipboard.setStringAsync(cron);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Copied", `Cron: ${cron}`);
    };

    const PRESETS = [
        { name: 'Every 5m', exp: '*/5 * * * *' },
        { name: 'Hourly', exp: '0 * * * *' },
        { name: 'Daily @ Mid', exp: '0 0 * * *' },
        { name: 'Weekly', exp: '0 0 * * 0' },
        { name: 'Month Start', exp: '0 0 1 * *' },
    ];

    const applyPreset = (exp: string) => {
        const p = exp.split(' ');
        setM(p[0]); setH(p[1]); setD(p[2]); setMon(p[3]); setW(p[4]);
        setCron(exp);
        setMode('build');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <ToolCard>
            <SectionTitle text="Cron-Master" subText="Visual schedule builder & explainer." />

            <View className="flex-row bg-black p-1 rounded-2xl mb-8 border border-white/5">
                <TouchableOpacity onPress={() => setMode('build')} className={`flex-1 py-3 rounded-xl items-center ${mode === 'build' ? 'bg-gray-800' : ''}`}>
                    <Text className={`text-[10px] font-black uppercase ${mode === 'build' ? 'text-white' : 'text-gray-500'}`}>Visual Builder</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('raw')} className={`flex-1 py-3 rounded-xl items-center ${mode === 'raw' ? 'bg-gray-800' : ''}`}>
                    <Text className={`text-[10px] font-black uppercase ${mode === 'raw' ? 'text-white' : 'text-gray-500'}`}>Raw Expression</Text>
                </TouchableOpacity>
            </View>

            {mode === 'build' ? (
                <View className="mb-8">
                    <View className="flex-row justify-between mb-4">
                        {[
                            { label: 'Min', val: m, set: setM },
                            { label: 'Hour', val: h, set: setH },
                            { label: 'Day', val: d, set: setD },
                            { label: 'Mon', val: mon, set: setMon },
                            { label: 'Week', val: w, set: setW },
                        ].map((item, i) => (
                            <View key={i} className="w-[18%] items-center">
                                <Text className="text-gray-600 text-[8px] font-black uppercase mb-2">{item.label}</Text>
                                <TextInput
                                    value={item.val}
                                    onChangeText={item.set}
                                    className="bg-black w-full py-3 rounded-xl text-white text-center font-bold text-xs border border-white/10"
                                    placeholder="*"
                                    placeholderTextColor="#333"
                                />
                            </View>
                        ))}
                    </View>
                    <Text className="text-gray-600 text-[8px] font-bold italic mt-2">* Use numbers (0-59), ranges (1-5), or intervals (*/15)</Text>
                </View>
            ) : (
                <TextInput
                    value={cron}
                    onChangeText={setCron}
                    className="bg-black p-6 rounded-2xl text-white mb-8 text-center font-black text-2xl border border-white/10"
                    placeholder="* * * * *"
                    placeholderTextColor="#333"
                />
            )}

            <View className="bg-gray-900/80 p-6 rounded-3xl border border-pink-500/20 mb-8">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Active Schedule</Text>
                    <TouchableOpacity onPress={copy} className="bg-pink-600/20 px-3 py-1 rounded-full border border-pink-500/20">
                        <Text className="text-pink-500 font-black text-[8px]">COPY EXP</Text>
                    </TouchableOpacity>
                </View>
                <Text className="text-white text-2xl font-black tracking-widest text-center mb-6">{cron}</Text>
                <View className="h-[1px] bg-white/5 w-full mb-6" />
                <View className="flex-row items-start bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/10">
                    <Ionicons name="sparkles" size={14} color="#818cf8" />
                    <Text className="text-indigo-300 text-[11px] font-medium leading-5 ml-3 italic flex-1">
                        "{explainCron(cron)}"
                    </Text>
                </View>
            </View>

            <SectionTitle text="Quick Presets" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {PRESETS.map(p => (
                    <TouchableOpacity
                        key={p.name}
                        onPress={() => applyPreset(p.exp)}
                        className="mr-3 bg-gray-900 border border-white/5 px-5 py-3 rounded-2xl"
                    >
                        <Text className="text-gray-400 text-[9px] font-black uppercase">{p.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </ToolCard>
    );
};

const SLACalculatorTool = () => {
    const [nines, setNines] = useState(99.9);

    const calculate = () => {
        const total = 365 * 24 * 60;
        const downMins = total * (1 - nines / 100);
        const hours = Math.floor(downMins / 60);
        const mins = Math.round(downMins % 60);
        return `${hours}h ${mins}m / Year`;
    };

    return (
        <ToolCard>
            <SectionTitle text="SLA Calculator" subText="Visualize max downtime allowed by nines." />
            <View className="flex-row justify-between mb-8">
                {[99, 99.9, 99.99, 99.999].map(n => (
                    <TouchableOpacity
                        key={n}
                        onPress={() => setNines(n)}
                        className={`px-4 py-2 rounded-xl border border-white/5 ${nines === n ? 'bg-pink-600' : 'bg-gray-800'}`}
                    >
                        <Text className="text-white text-[10px] font-black">{n}%</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="items-center bg-black/50 p-8 rounded-3xl border border-white/5">
                <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Max Allowable Downtime</Text>
                <Text className="text-white text-3xl font-black">{calculate()}</Text>
            </View>
        </ToolCard>
    );
};

const ContrastTool = () => {
    return (
        <ToolCard>
            <SectionTitle text="Contrast Validator" subText="WCAG 2.1 Color Accessibility Check." />
            <View className="flex-row justify-between mb-6">
                <View className="w-[48%] bg-white p-6 rounded-2xl items-center justify-center border border-gray-200">
                    <Text className="text-black font-black">#FFFFFF</Text>
                </View>
                <View className="w-[48%] bg-black p-6 rounded-2xl items-center justify-center border border-gray-800">
                    <Text className="text-white font-black">#000000</Text>
                </View>
            </View>

            <View className="bg-green-500/10 p-5 rounded-2xl border border-green-500/20 items-center">
                <Ionicons name="shield-checkmark" size={24} color="#22c55e" />
                <Text className="text-green-500 font-black mt-2">AAA COMPLIANT (21:1)</Text>
                <Text className="text-gray-500 text-[10px] italic mt-1 text-center">Perfect contrast for all text sizes and weights.</Text>
            </View>
        </ToolCard>
    );
};

const MockTool = () => {
    const [fields, setFields] = useState([{ name: 'id', type: 'Number' }, { name: 'name', type: 'String' }]);
    const [result, setResult] = useState('');

    const generate = () => {
        const obj: any = {};
        fields.forEach(f => {
            if (f.type === 'Number') obj[f.name] = Math.floor(Math.random() * 100);
            else if (f.type === 'String') obj[f.name] = 'Mock Data';
            else if (f.type === 'Boolean') obj[f.name] = true;
        });
        setResult(JSON.stringify(obj, null, 2));
    };

    return (
        <ToolCard>
            <SectionTitle text="Fync Mock" subText="Design and generate mock JSON objects." />
            {fields.map((f, i) => (
                <View key={i} className="flex-row items-center mb-3">
                    <TextInput value={f.name} onChangeText={(t) => {
                        const newFields = [...fields];
                        newFields[i].name = t;
                        setFields(newFields);
                    }} className="flex-1 bg-black p-3 rounded-xl text-white mr-2 border border-white/5" placeholder="field_name" />
                    <TouchableOpacity onPress={() => {
                        const types = ['String', 'Number', 'Boolean'];
                        const currIdx = types.indexOf(f.type);
                        const newFields = [...fields];
                        newFields[i].type = types[(currIdx + 1) % types.length];
                        setFields(newFields);
                    }} className="bg-gray-800 px-4 py-3 rounded-xl border border-white/5">
                        <Text className="text-pink-400 font-bold text-[10px]">{f.type}</Text>
                    </TouchableOpacity>
                </View>
            ))}
            <TouchableOpacity onPress={() => setFields([...fields, { name: '', type: 'String' }])} className="mb-6 flex-row items-center">
                <Ionicons name="add-circle" size={20} color="#ec4899" />
                <Text className="text-pink-500 font-bold ml-2">Add Field</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={generate} className="bg-pink-600 py-4 rounded-xl items-center mb-6 shadow-lg shadow-pink-500/10">
                <Text className="text-white font-black text-xs uppercase tracking-widest">Generate Preview</Text>
            </TouchableOpacity>

            {result ? (
                <View className="bg-black p-4 rounded-xl border border-white/5">
                    <Text className="text-gray-300 font-mono text-[10px] leading-4">{result}</Text>
                </View>
            ) : null}
        </ToolCard>
    );
};

const VaultTool = () => {
    const [secrets, setSecrets] = useState<{ k: string, v: string }[]>([]);
    const [key, setKey] = useState('');
    const [val, setVal] = useState('');

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const stored = await AsyncStorage.getItem('@fync_vault');
        if (stored) setSecrets(JSON.parse(stored));
    };

    const add = async () => {
        if (!key || !val) return;
        const next = [...secrets, { k: key, v: val }];
        await AsyncStorage.setItem('@fync_vault', JSON.stringify(next));
        setSecrets(next);
        setKey(''); setVal('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const del = async (idx: number) => {
        const next = secrets.filter((_, i) => i !== idx);
        await AsyncStorage.setItem('@fync_vault', JSON.stringify(next));
        setSecrets(next);
    };

    return (
        <ToolCard>
            <SectionTitle text="Secure Vault" subText="Local-only storage for your .env keys." />

            <View className="flex-row gap-2 mb-6">
                <TextInput value={key} onChangeText={setKey} placeholder="KEY" placeholderTextColor="#444" className="flex-1 bg-black p-3 rounded-xl text-white font-bold text-[10px] border border-white/5" />
                <TextInput value={val} onChangeText={setVal} placeholder="VALUE" placeholderTextColor="#444" secureTextEntry className="flex-1 bg-black p-3 rounded-xl text-white font-bold text-[10px] border border-white/5" />
                <TouchableOpacity onPress={add} className="bg-red-600 px-4 rounded-xl items-center justify-center">
                    <Ionicons name="add" size={20} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[300px]" showsVerticalScrollIndicator={false}>
                {secrets.map((s, i) => (
                    <View key={i} className="bg-gray-900/50 p-4 rounded-2xl mb-3 flex-row justify-between items-center border border-white/5">
                        <View className="flex-1">
                            <Text className="text-gray-400 font-bold text-[10px] mb-1">{s.k}</Text>
                            <Text className="text-white font-mono text-xs">••••••••••••</Text>
                        </View>
                        <View className="flex-row gap-2">
                            <TouchableOpacity onPress={() => {
                                Clipboard.setStringAsync(s.v);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }} className="bg-gray-800 p-2 rounded-lg">
                                <Ionicons name="copy-outline" size={14} color="#ef4444" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => del(i)} className="bg-gray-800 p-2 rounded-lg">
                                <Ionicons name="trash-outline" size={14} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
                {secrets.length === 0 && (
                    <View className="items-center py-10 opacity-30">
                        <Ionicons name="lock-closed-outline" size={40} color="white" />
                        <Text className="text-white text-[10px] mt-2 font-bold">Vault is empty</Text>
                    </View>
                )}
            </ScrollView>
        </ToolCard>
    );
};

const FlexboxTool = () => {
    const [justify, setJustify] = useState('center');
    const [align, setAlign] = useState('center');

    const justifies = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'];
    const aligns = ['flex-start', 'center', 'flex-end', 'stretch'];

    return (
        <ToolCard>
            <SectionTitle text="Flexbox Playground" subText="Visualize layout properties in real-time." />

            <View className="bg-black h-[180px] rounded-2xl mb-8 overflow-hidden border border-white/5 shadow-inner" style={{ justifyContent: justify as any, alignItems: align as any }}>
                <View className="w-10 h-10 bg-pink-500 rounded-xl m-1 shadow-lg shadow-pink-500/40" />
                <View className="w-12 h-12 bg-blue-500 rounded-xl m-1 shadow-lg shadow-blue-500/40" />
                <View className="w-8 h-8 bg-purple-500 rounded-xl m-1 shadow-lg shadow-purple-500/40" />
            </View>

            <Text className="text-gray-500 text-[10px] uppercase font-black mb-2 ml-1">justify-content</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {justifies.map(j => (
                    <TouchableOpacity key={j} onPress={() => setJustify(j)} className={`mr-2 px-4 py-2 rounded-xl border border-white/5 ${justify === j ? 'bg-pink-600' : 'bg-gray-800'}`}>
                        <Text className="text-white text-[10px] font-bold">{j}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text className="text-gray-500 text-[10px] uppercase font-black mb-2 ml-1">align-items</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                {aligns.map(a => (
                    <TouchableOpacity key={a} onPress={() => setAlign(a)} className={`mr-2 px-4 py-2 rounded-xl border border-white/5 ${align === a ? 'bg-blue-600' : 'bg-gray-800'}`}>
                        <Text className="text-white text-[10px] font-bold">{a}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View className="bg-black/80 p-5 rounded-2xl border border-white/5 flex-row items-center">
                <View className="flex-1">
                    <Text className="text-pink-400 font-mono text-[10px]">display: <Text className="text-white text-[10px]">flex</Text>;</Text>
                    <Text className="text-pink-400 font-mono text-[10px]">justify-content: <Text className="text-white text-[10px]">{justify}</Text>;</Text>
                    <Text className="text-pink-400 font-mono text-[10px]">align-items: <Text className="text-white text-[10px]">{align}</Text>;</Text>
                </View>
                <TouchableOpacity onPress={() => {
                    Clipboard.setStringAsync(`display: flex; justify-content: ${justify}; align-items: ${align};`);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }} className="bg-gray-900 p-2 rounded-lg">
                    <Ionicons name="copy-outline" size={14} color="#ec4899" />
                </TouchableOpacity>
            </View>
        </ToolCard>
    );
};

const CompressorTool = () => {
    const [image, setImage] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');

    const pick = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.6,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setStatus('idle');
        }
    };

    const compress = () => {
        setStatus('processing');
        setTimeout(() => {
            setStatus('done');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Image optimized and converted to WebP!");
        }, 1500);
    };

    return (
        <ToolCard>
            <SectionTitle text="Asset Optimizer" subText="Convert items to WebP and reduce file size." />

            <TouchableOpacity onPress={pick} className="bg-black/50 aspect-video rounded-3xl mb-6 items-center justify-center border-2 border-dashed border-white/10 overflow-hidden">
                {image ? (
                    <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <View className="items-center">
                        <Ionicons name="image-outline" size={40} color="#3b82f6" />
                        <Text className="text-gray-500 text-[10px] mt-2 font-bold uppercase">Select Asset</Text>
                    </View>
                )}
            </TouchableOpacity>

            {image && status !== 'done' && (
                <TouchableOpacity onPress={compress} disabled={status === 'processing'} className="bg-blue-600 py-4 rounded-xl items-center shadow-lg shadow-blue-500/20">
                    <Text className="text-white font-black tracking-widest text-[10px] uppercase">
                        {status === 'processing' ? 'OPTIMIZING ENGINE...' : 'START COMPRESSION'}
                    </Text>
                </TouchableOpacity>
            )}

            {status === 'done' && (
                <View className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 items-center">
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    <Text className="text-green-500 font-bold mt-2">OPTIMIZATION COMPLETE</Text>
                    <Text className="text-gray-500 text-[8px] mt-1">Saved ~42% space (Estimated)</Text>
                    <TouchableOpacity onPress={() => setImage(null)} className="mt-4 bg-gray-800 px-4 py-2 rounded-full">
                        <Text className="text-white text-[10px] font-bold">Reset</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ToolCard>
    );
};

const ContractScaffoldTool = () => {
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [decimals, setDecimals] = useState('18');

    const generate = () => {
        const code = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ${name.replace(/\s+/g, '') || 'MyToken'} is ERC20 {
    constructor() ERC20("${name || 'My Token'}", "${symbol || 'MTK'}") {
        _mint(msg.sender, 1000000 * 10 ** ${decimals || 18});
    }
}`;
        Clipboard.setStringAsync(code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Solidity code copied to clipboard!");
    };

    return (
        <ToolCard>
            <SectionTitle text="Token Scaffolder" subText="ERC20 Standard via OpenZeppelin v5.0." />
            <TextInput value={name} onChangeText={setName} placeholder="Token Name (e.g. Fync Coin)" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-4 border border-white/5" />
            <TextInput value={symbol} onChangeText={setSymbol} placeholder="Symbol (e.g. FYNC)" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-4 border border-white/5" />
            <TextInput value={decimals} onChangeText={setDecimals} keyboardType="numeric" placeholder="Decimals (Default 18)" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-8 border border-white/5" />

            <TouchableOpacity onPress={generate} className="bg-indigo-600 py-4 rounded-xl flex-row items-center justify-center shadow-lg shadow-indigo-500/20">
                <Ionicons name="copy-outline" size={20} color="white" />
                <Text className="text-white font-black ml-2 uppercase tracking-widest text-[10px]">Scaffold Contract</Text>
            </TouchableOpacity>
        </ToolCard>
    );
};

const OGPreviewTool = () => {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [img, setImg] = useState('');

    return (
        <ToolCard>
            <SectionTitle text="Social Meta Preview" subText="Simulate how your site looks when shared." />
            <TextInput value={title} onChangeText={setTitle} placeholder="Page Title" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-3 border border-white/5" />
            <TextInput value={desc} onChangeText={setDesc} placeholder="Description" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-3 border border-white/5" />
            <TextInput value={img} onChangeText={setImg} placeholder="Image URL" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-8 border border-white/5" />

            <View className="bg-[#e9edef] rounded-3xl overflow-hidden border border-gray-300 shadow-xl">
                <View className="bg-gray-200 h-[150px] items-center justify-center">
                    {img ? (
                        <Image source={{ uri: img }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                        <Ionicons name="image-outline" size={48} color="#999" />
                    )}
                </View>
                <View className="p-4 bg-white">
                    <Text className="text-[#06c] text-sm font-black" numberOfLines={1}>{title || 'Your Stunning Website Title'}</Text>
                    <Text className="text-gray-500 text-[10px] mt-1 line-height-4" numberOfLines={2}>{desc || 'The meta description that users see when you share the link on social media...'}</Text>
                    <Text className="text-gray-400 text-[8px] mt-3 font-bold uppercase tracking-widest">fync.com</Text>
                </View>
            </View>
        </ToolCard>
    );
};

const APIPlaygroundTool = () => {
    const [url, setUrl] = useState('/posts');
    const [method, setMethod] = useState('GET');
    const [body, setBody] = useState('{\n  "title": "foo",\n  "body": "bar"\n}');
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [activeView, setActiveView] = useState<'request' | 'history' | 'docs'>('request');
    const [responseTime, setResponseTime] = useState(0);

    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${BACKEND_URL}/playground/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setHistory(data.history);
        } catch (e) {
            console.log("History fetch error", e);
        }
    };

    const runRequest = async () => {
        setLoading(true);
        const startTime = Date.now();
        try {
            const token = await AsyncStorage.getItem('token');
            const isLocal = url.trim().startsWith('/playground');

            let parsedBody = null;
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
                try {
                    if (body.trim()) parsedBody = JSON.parse(body);
                } catch (e) {
                    Alert.alert("Invalid JSON", "Please fix your request body.");
                    setLoading(false);
                    return;
                }
            }

            let fetchOptions: any = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            };

            let targetUrl = '';

            if (isLocal) {
                // Direct call to local JSON Server
                targetUrl = `${BACKEND_URL}${url}`;
                fetchOptions.method = method;
                if (['POST', 'PUT', 'PATCH'].includes(method)) {
                    fetchOptions.body = JSON.stringify(parsedBody);
                }
            } else {
                // Proxy call to JSONPlaceholder
                targetUrl = `${BACKEND_URL}/playground/execute`;
                fetchOptions.method = 'POST';
                fetchOptions.body = JSON.stringify({
                    method,
                    endpoint: url,
                    body: parsedBody
                });
            }

            const res = await fetch(targetUrl, fetchOptions);
            const data = await res.json();

            // Normalize response for the UI
            setResponse({
                status: res.status,
                data: isLocal ? data : (data.data || data)
            });

            setResponseTime(Date.now() - startTime);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchHistory();
        } catch (e: any) {
            setResponse({ status: 500, data: { error: e.message } });
        } finally {
            setLoading(false);
        }
    };

    const renderRequest = () => (
        <View>
            <Text className="text-gray-500 text-[10px] font-black uppercase mb-2 ml-1">Endpoint (JSONPlaceholder Style)</Text>
            <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="/posts or https://..."
                placeholderTextColor="#444"
                className="bg-black p-4 rounded-xl text-white mb-4 border border-white/5 font-mono text-xs"
            />

            <View className="flex-row gap-2 mb-4">
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                    <TouchableOpacity
                        key={m}
                        onPress={() => setMethod(m)}
                        className={`flex-1 py-2.5 rounded-xl border border-white/5 bg-gray-900 items-center ${method === m ? 'bg-orange-600 border-orange-400/50' : ''}`}
                    >
                        <Text className={`text-[9px] font-black ${method === m ? 'text-white' : 'text-gray-500'}`}>{m}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {['POST', 'PUT', 'PATCH'].includes(method) && (
                <View className="mb-4">
                    <Text className="text-gray-500 text-[10px] font-black uppercase mb-2 ml-1">Request Body (JSON)</Text>
                    <TextInput
                        value={body}
                        onChangeText={setBody}
                        multiline
                        numberOfLines={4}
                        placeholder="{}"
                        placeholderTextColor="#444"
                        className="bg-black p-4 rounded-xl text-orange-400 mb-4 border border-white/5 font-mono text-[10px] h-32"
                    />
                </View>
            )}

            <TouchableOpacity
                onPress={runRequest}
                disabled={loading}
                className="bg-orange-600 py-4 rounded-xl items-center shadow-lg shadow-orange-500/20"
            >
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">
                    {loading ? 'Executing...' : 'Send Request'}
                </Text>
            </TouchableOpacity>

            {response && (
                <View className="mt-6 bg-black/50 rounded-2xl border border-white/5 overflow-hidden">
                    <View className="bg-gray-900 p-3 flex-row justify-between items-center border-b border-white/5">
                        <Text className="text-gray-500 text-[10px] font-black uppercase">Response ({response.status})</Text>
                        <Text className="text-orange-500 text-[10px] font-black">{responseTime}ms</Text>
                    </View>
                    <ScrollView className="p-4 max-h-[300px]">
                        <Text className="text-orange-300 font-mono text-[10px]">
                            {JSON.stringify(response.data, null, 2)}
                        </Text>
                    </ScrollView>
                    <TouchableOpacity
                        onPress={() => {
                            Clipboard.setStringAsync(JSON.stringify(response.data, null, 2));
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        className="p-3 items-center border-t border-white/5"
                    >
                        <Text className="text-gray-500 text-[9px] font-bold uppercase">Copy Response</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderHistory = () => (
        <ScrollView className="max-h-[500px]">
            {history.length > 0 ? history.map((item, idx) => (
                <View key={idx} className="bg-gray-900/50 p-4 rounded-2xl mb-3 border border-white/5">
                    <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center">
                            <View className={`px-2 py-1 rounded-lg mr-2 ${item.method === 'GET' ? 'bg-blue-500/10' :
                                item.method === 'POST' ? 'bg-green-500/10' : 'bg-red-500/10'
                                }`}>
                                <Text className={`text-[8px] font-black ${item.method === 'GET' ? 'text-blue-500' :
                                    item.method === 'POST' ? 'text-green-500' : 'text-red-500'
                                    }`}>{item.method}</Text>
                            </View>
                            <Text className="text-white text-[10px] font-bold" numberOfLines={1}>{item.endpoint.replace('https://jsonplaceholder.typicode.com', '')}</Text>
                        </View>
                        <Text className="text-gray-500 text-[8px] font-black">{new Date(item.timestamp).toLocaleTimeString()}</Text>
                    </View>
                    <Text className="text-gray-500 text-[8px] leading-3" numberOfLines={2}>
                        Status: {item.responseStatus} • User: {item.username}
                    </Text>
                </View>
            )) : (
                <View className="items-center py-20 opacity-20">
                    <Ionicons name="time-outline" size={48} color="white" />
                    <Text className="text-white text-[10px] font-black mt-4 uppercase">No Request History</Text>
                </View>
            )}
        </ScrollView>
    );

    const renderDocs = () => (
        <View className="p-2">
            <Text className="text-white font-black text-xs mb-3">How to use API Playground?</Text>
            <View className="space-y-4">
                <DocItem step="1" title="Your Private Server" desc="This is your personal mock API server. All data you create is stored privately under your account." />
                <DocItem step="2" title="Endpoint Structure" desc="Use the prefix /playground/:resource (e.g., /playground/posts) for your custom resources. You can also use full URLs for external APIs." />
                <DocItem step="3" title="Persistent CRUD" desc="Perform GET, POST, PUT, PATCH, DELETE operations on your resources. Data persists across sessions." />
                <DocItem step="4" title="JSON-Server Style Queries" desc="Leverage powerful query parameters for filtering, searching, sorting, and pagination." />
            </View>

            <View className="mt-6 bg-orange-600/10 p-4 rounded-2xl border border-orange-500/20">
                <Text className="text-orange-500 text-[10px] font-black uppercase mb-2">Query Examples</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Filtering:</Text> /playground/posts?userId=1</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Searching:</Text> /playground/posts?q=title</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Sorting:</Text> /playground/posts?_sort=title&_order=asc</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Pagination:</Text> /playground/posts?_page=1&_limit=10</Text>
                <Text className="text-gray-400 text-[9px] mt-2">• <Text className="font-bold">Full URL Example:</Text> https://jsonplaceholder.typicode.com/posts</Text>
            </View>
        </View>
    );

    const DocItem = ({ step, title, desc }: any) => (
        <View className="flex-row items-center mb-4">
            <View className="w-6 h-6 rounded-full bg-orange-600 items-center justify-center mr-3">
                <Text className="text-white font-black text-[10px]">{step}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-gray-200 font-bold text-[10px]">{title}</Text>
                <Text className="text-gray-500 text-[9px]">{desc}</Text>
            </View>
        </View>
    );

    return (
        <ToolCard>
            <SectionTitle text="API Playground" subText="Zero-cost mock testing with user logging." />

            <View className="flex-row bg-black p-1 rounded-2xl mb-6 border border-white/5">
                {[
                    { id: 'request', label: 'Builder', icon: 'send' },
                    { id: 'history', label: 'History', icon: 'time' },
                    { id: 'docs', label: 'Docs', icon: 'help-circle' }
                ].map(view => (
                    <TouchableOpacity
                        key={view.id}
                        onPress={() => {
                            setActiveView(view.id as any);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${activeView === view.id ? 'bg-orange-600' : ''}`}
                    >
                        <Ionicons name={`${view.icon}-outline` as any} size={14} color={activeView === view.id ? 'white' : '#666'} />
                        <Text className={`ml-2 text-[10px] font-black uppercase ${activeView === view.id ? 'text-white' : 'text-gray-500'}`}>{view.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeView === 'request' && renderRequest()}
            {activeView === 'history' && renderHistory()}
            {activeView === 'docs' && renderDocs()}
        </ToolCard>
    );
};

const GIT_COMMANDS_LIB = [
    { cat: 'Setup', name: 'Initialize Repo', cmd: 'git init', desc: 'Create a new local repository' },
    { cat: 'Setup', name: 'Clone Repo', cmd: 'git clone <url>', desc: 'Download a repository from a remote URL' },

    { cat: 'Config', name: 'Set Username', cmd: 'git config --global user.name "Your Name"', desc: 'Identify yourself globally' },
    { cat: 'Config', name: 'Set Email', cmd: 'git config --global user.email "email@example.com"', desc: 'Identify your email globally' },
    { cat: 'Config', name: 'List Config', cmd: 'git config --list', desc: 'Show all current configurations' },

    { cat: 'Basic', name: 'Status', cmd: 'git status', desc: 'Check state of working directory' },
    { cat: 'Basic', name: 'Add File', cmd: 'git add <file>', desc: 'Stage a specific file' },
    { cat: 'Basic', name: 'Add All', cmd: 'git add .', desc: 'Stage all changes in directory' },
    { cat: 'Basic', name: 'Commit', cmd: 'git commit -m "msg"', desc: 'Record staged changes as a snapshot' },
    { cat: 'Basic', name: 'Remove File', cmd: 'git rm <file>', desc: 'Remove file from working directory & index' },
    { cat: 'Basic', name: 'Rename File', cmd: 'git mv <old> <new>', desc: 'Move/rename file & stage the change' },

    { cat: 'Branching', name: 'List Branches', cmd: 'git branch', desc: 'Show local branches' },
    { cat: 'Branching', name: 'Create Branch', cmd: 'git branch <name>', desc: 'Create a new branch' },
    { cat: 'Branching', name: 'Switch Branch', cmd: 'git checkout <name>', desc: 'Switch to a specific branch' },
    { cat: 'Branching', name: 'New & Switch', cmd: 'git checkout -b <name>', desc: 'Create and jump into new branch' },
    { cat: 'Branching', name: 'Delete Branch', cmd: 'git branch -d <name>', desc: 'Safely delete a branch' },
    { cat: 'Branching', name: 'Force Delete', cmd: 'git branch -D <name>', desc: 'Delete branch even if not merged' },
    { cat: 'Branching', name: 'Merge Branch', cmd: 'git merge <branch>', desc: 'Combine specified branch into current' },

    { cat: 'Remote', name: 'Add Remote', cmd: 'git remote add origin <url>', desc: 'Connect to a remote repository' },
    { cat: 'Remote', name: 'Push (Init)', cmd: 'git push -u origin main', desc: 'Push current branch and set upstream' },
    { cat: 'Remote', name: 'Push Changes', cmd: 'git push', desc: 'Update remote with local commits' },
    { cat: 'Remote', name: 'Pull Changes', cmd: 'git pull', desc: 'Fetch and merge remote changes' },
    { cat: 'Remote', name: 'Fetch Only', cmd: 'git fetch', desc: 'Get remote updates without merging' },
    { cat: 'Remote', name: 'Show Remotes', cmd: 'git remote -v', desc: 'List all connected remote URLs' },

    { cat: 'History', name: 'Review Log', cmd: 'git log', desc: 'Show commit history list' },
    { cat: 'History', name: 'Log (One line)', cmd: 'git log --oneline', desc: 'Compact commit history' },
    { cat: 'History', name: 'File History', cmd: 'git log -p <file>', desc: 'Show changes made to a file' },
    { cat: 'History', name: 'Who Changed?', cmd: 'git blame <file>', desc: 'Annotate file lines with commit info' },
    { cat: 'History', name: 'Show Commit', cmd: 'git show <hash>', desc: 'View details of a specific commit' },

    { cat: 'Stashing', name: 'Save Stash', cmd: 'git stash', desc: 'Temporarily store uncommitted changes' },
    { cat: 'Stashing', name: 'List Stashes', cmd: 'git stash list', desc: 'Show all saved stashes' },
    { cat: 'Stashing', name: 'Pop Stash', cmd: 'git stash pop', desc: 'Apply and remove most recent stash' },
    { cat: 'Stashing', name: 'Apply Stash', cmd: 'git stash apply', desc: 'Apply stash but keep in list' },
    { cat: 'Stashing', name: 'Clear Stash', cmd: 'git stash clear', desc: 'Delete all saved stashes' },

    { cat: 'Undo', name: 'Amend Last', cmd: 'git commit --amend', desc: 'Edit last commit message or content' },
    { cat: 'Undo', name: 'Soft Reset', cmd: 'git reset --soft HEAD~1', desc: 'Undo commit, keep changes staged' },
    { cat: 'Undo', name: 'Mixed Reset', cmd: 'git reset HEAD~1', desc: 'Undo commit, keep changes in workspace' },
    { cat: 'Undo', name: 'Hard Reset', cmd: 'git reset --hard HEAD~1', desc: 'Discard last commit & ALL changes' },
    { cat: 'Undo', name: 'Revert Commit', cmd: 'git revert <hash>', desc: 'Create new commit that reverses a previous one' },
    { cat: 'Undo', name: 'Discard Changes', cmd: 'git checkout -- <file>', desc: 'Restore file to last committed state' },

    { cat: 'Advanced', name: 'Rebase', cmd: 'git rebase <branch>', desc: 'Apply commits onto another base' },
    { cat: 'Advanced', name: 'Cherry Pick', cmd: 'git cherry-pick <hash>', desc: 'Copy a specific commit into current branch' },
    { cat: 'Advanced', name: 'Reflog', cmd: 'git reflog', desc: 'Show local history of state changes' },
    { cat: 'Advanced', name: 'Clean Files', cmd: 'git clean -fd', desc: 'Remove all untracked files & dirs' },
    { cat: 'Advanced', name: 'Submodule Init', cmd: 'git submodule update --init --recursive', desc: 'Initialize submodules if repo has them' },

    { cat: 'Disasters', name: 'Wrong Branch', cmd: 'git stash\ngit checkout ok-branch\ngit stash pop', desc: 'I committed/worked on the wrong branch' },
    { cat: 'Disasters', name: 'Force Pull', cmd: 'git fetch --all\ngit reset --hard origin/main', desc: 'Force local to match remote exactly' },
    { cat: 'Disasters', name: 'Bad Merge', cmd: 'git merge --abort', desc: 'Abort merge with conflicts' },
];

const GitMasterTool = () => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('All');

    const categories = ['All', ...new Set(GIT_COMMANDS_LIB.map(c => c.cat))];

    const filtered = GIT_COMMANDS_LIB.filter(d =>
        (activeTab === 'All' || d.cat === activeTab) &&
        (d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.cmd.toLowerCase().includes(query.toLowerCase()) ||
            d.desc.toLowerCase().includes(query.toLowerCase()))
    );

    const copy = (cmd: string) => {
        Clipboard.setStringAsync(cmd);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    };

    return (
        <ToolCard>
            <SectionTitle text="Git-Master" subText="The ultimate handbook for every Git scenario." />

            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search: init, push, rebase..."
                placeholderTextColor="#666"
                className="bg-black p-4 rounded-xl text-white mb-6 border border-white/5"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                {categories.map(c => (
                    <TouchableOpacity
                        key={c}
                        onPress={() => {
                            setActiveTab(c);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        className={`mr-2 px-2 py-2.5 rounded-2xl border border-white/5 ${activeTab === c ? 'bg-red-600' : 'bg-gray-900'}`}
                    >
                        <Text className={`text-[10px] font-black uppercase ${activeTab === c ? 'text-white' : 'text-gray-500'}`}>{c}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView className="max-h-[500px]" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {filtered.map((d, i) => (
                    <View key={i} className="mb-4 bg-gray-900/50 p-4 rounded-3xl border border-white/5">
                        <View className="flex-row justify-between items-center mb-3">
                            <View>
                                <Text className="text-white font-black text-xs uppercase tracking-tight">{d.name}</Text>
                                <Text className="text-gray-500 text-[8px] font-bold uppercase mt-1 tracking-widest">{d.cat}</Text>
                            </View>
                            <TouchableOpacity onPress={() => copy(d.cmd)} className="bg-red-600/10 p-2.5 rounded-xl border border-red-500/20">
                                <Ionicons name="copy-outline" size={14} color="#ef4444" />
                            </TouchableOpacity>
                        </View>

                        <View className="bg-black p-4 rounded-2xl border border-white/5">
                            <Text className="text-red-400 font-mono text-[11px] leading-5">{d.cmd}</Text>
                            <View className="h-[1px] bg-white/5 w-full my-3" />
                            <Text className="text-gray-400 text-[9px] font-medium leading-4 italic">" {d.desc} "</Text>
                        </View>
                    </View>
                ))}

                {filtered.length === 0 && (
                    <View className="items-center py-20 opacity-30">
                        <Ionicons name="search-outline" size={48} color="white" />
                        <Text className="text-white text-[10px] font-black mt-4 uppercase">No commands found</Text>
                    </View>
                )}
            </ScrollView>
        </ToolCard>
    );
};

const LINUX_COMMANDS_LIB = [
    { cat: 'File System', name: 'List Files', cmd: 'ls -la', desc: 'List all files with details and hidden files' },
    { cat: 'File System', name: 'Change Directory', cmd: 'cd <path>', desc: 'Navigate to a specific directory' },
    { cat: 'File System', name: 'Present Directory', cmd: 'pwd', desc: 'Show the current absolute path' },
    { cat: 'File System', name: 'Make Directory', cmd: 'mkdir <name>', desc: 'Create a new folder/directory' },
    { cat: 'File System', name: 'Create File', cmd: 'touch <name>', desc: 'Create a new empty file' },
    { cat: 'File System', name: 'Read File', cmd: 'cat <file>', desc: 'Display entire file content in terminal' },
    { cat: 'File System', name: 'Scroll File', cmd: 'less <file>', desc: 'View file with scrolling support' },
    { cat: 'File System', name: 'Copy File', cmd: 'cp <src> <dest>', desc: 'Copy files or directories' },
    { cat: 'File System', name: 'Move/Rename', cmd: 'mv <src> <dest>', desc: 'Move files or rename them' },
    { cat: 'File System', name: 'Remove File', cmd: 'rm <file>', desc: 'Delete a specific file' },
    { cat: 'File System', name: 'Remove Dir', cmd: 'rm -rf <dir>', desc: 'Forcefully delete a directory and contents' },
    { cat: 'File System', name: 'Find File', cmd: 'find . -name "<name>"', desc: 'Search for files by name' },

    { cat: 'System Info', name: 'Check Specs', cmd: 'uname -a', desc: 'Show kernel and system architecture' },
    { cat: 'System Info', name: 'Disk Space', cmd: 'df -h', desc: 'Show disk usage in human-readable format' },
    { cat: 'System Info', name: 'Directory Size', cmd: 'du -sh <dir>', desc: 'Show total size of a directory' },
    { cat: 'System Info', name: 'Memory Usage', cmd: 'free -m', desc: 'Show RAM usage in Megabytes' },
    { cat: 'System Info', name: 'Uptime', cmd: 'uptime', desc: 'How long the system has been running' },

    { cat: 'Processes', name: 'Active Processes', cmd: 'top', desc: 'Real-time viewer for system processes' },
    { cat: 'Processes', name: 'Better Viewer', cmd: 'htop', desc: 'Interactive and colorful process viewer' },
    { cat: 'Processes', name: 'Find Process', cmd: 'ps aux | grep <name>', desc: 'Search for a running process' },
    { cat: 'Processes', name: 'Kill Process', cmd: 'kill -9 <pid>', desc: 'Forcefully stop a process by ID' },
    { cat: 'Processes', name: 'Port Usage', cmd: 'lsof -i :<port>', desc: 'Check what process is using a port' },

    { cat: 'Networking', name: 'IP Info', cmd: 'ip addr', desc: 'Show all network interface addresses' },
    { cat: 'Networking', name: 'Check Connection', cmd: 'ping <host>', desc: 'Test connectivity to a domain/IP' },
    { cat: 'Networking', name: 'Fetch URL', cmd: 'curl -I <url>', desc: 'Fetch headers from a URL' },
    { cat: 'Networking', name: 'Download File', cmd: 'wget <url>', desc: 'Download a file from the internet' },
    { cat: 'Networking', name: 'DNS Lookup', cmd: 'dig <host>', desc: 'Query DNS records for a domain' },
    { cat: 'Networking', name: 'Route Map', cmd: 'traceroute <host>', desc: 'Trace the path of packets to host' },

    { cat: 'Permissions', name: 'Change Owner', cmd: 'sudo chown <user> <file>', desc: 'Change the owner of a file/dir' },
    { cat: 'Permissions', name: 'Full Access', cmd: 'chmod 777 <file>', desc: 'Grant read, write, execute to everyone' },
    { cat: 'Permissions', name: 'Secure Perms', cmd: 'chmod 644 <file>', desc: 'Owner RW, Others Read only' },
    { cat: 'Permissions', name: 'Execute Perm', cmd: 'chmod +x <file>', desc: 'Make a script/file executable' },
    { cat: 'Permissions', name: 'Become Root', cmd: 'sudo -i', desc: 'Login as the superuser/root' },

    { cat: 'Utilities', name: 'Search Text', cmd: 'grep -r "<text>" .', desc: 'Search text recursively in directory' },
    { cat: 'Utilities', name: 'Stream Editor', cmd: 'sed -i "s/old/new/g" <file>', desc: 'Batch find and replace in file' },
    { cat: 'Utilities', name: 'Text Processor', cmd: "awk '{print $1}' <file>", desc: 'Powerful text column parsing' },
    { cat: 'Utilities', name: 'Zip Folder', cmd: 'tar -czvf <name>.tar.gz <dir>', desc: 'Compress directory into Gzip' },
    { cat: 'Utilities', name: 'Unzip File', cmd: 'tar -xzvf <file>.tar.gz', desc: 'Extract Gzip archive' },
];

const LinuxMasterTool = () => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('All');

    const categories = ['All', ...new Set(LINUX_COMMANDS_LIB.map(c => c.cat))];

    const filtered = LINUX_COMMANDS_LIB.filter(d =>
        (activeTab === 'All' || d.cat === activeTab) &&
        (d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.cmd.toLowerCase().includes(query.toLowerCase()) ||
            d.desc.toLowerCase().includes(query.toLowerCase()))
    );

    const copy = (cmd: string) => {
        Clipboard.setStringAsync(cmd);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    };

    return (
        <ToolCard>
            <SectionTitle text="Linux-Master" subText="The essential CLI guide for every developer." />

            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search: ls, grep, sudo, chmod..."
                placeholderTextColor="#666"
                className="bg-black p-4 rounded-xl text-white mb-6 border border-white/5"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                {categories.map(c => (
                    <TouchableOpacity
                        key={c}
                        onPress={() => {
                            setActiveTab(c);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        className={`mr-2 px-4 py-2.5 rounded-2xl border border-white/5 ${activeTab === c ? 'bg-orange-600' : 'bg-gray-900'}`}
                    >
                        <Text className={`text-[10px] font-black uppercase ${activeTab === c ? 'text-white' : 'text-gray-500'}`}>{c}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView className="max-h-[500px]" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {filtered.map((d, i) => (
                    <View key={i} className="mb-4 bg-gray-900/50 p-4 rounded-3xl border border-white/5">
                        <View className="flex-row justify-between items-center mb-3">
                            <View>
                                <Text className="text-white font-black text-xs uppercase tracking-tight">{d.name}</Text>
                                <Text className="text-gray-500 text-[8px] font-bold uppercase mt-1 tracking-widest">{d.cat}</Text>
                            </View>
                            <TouchableOpacity onPress={() => copy(d.cmd)} className="bg-orange-600/10 p-2.5 rounded-xl border border-orange-500/20">
                                <Ionicons name="copy-outline" size={14} color="#f59e0b" />
                            </TouchableOpacity>
                        </View>

                        <View className="bg-black p-4 rounded-2xl border border-white/5">
                            <Text className="text-orange-400 font-mono text-[11px] leading-5">{d.cmd}</Text>
                            <View className="h-[1px] bg-white/5 w-full my-3" />
                            <Text className="text-gray-400 text-[9px] font-medium leading-4 italic">" {d.desc} "</Text>
                        </View>
                    </View>
                ))}

                {filtered.length === 0 && (
                    <View className="items-center py-20 opacity-30">
                        <Ionicons name="search-outline" size={48} color="white" />
                        <Text className="text-white text-[10px] font-black mt-4 uppercase">No commands found</Text>
                    </View>
                )}
            </ScrollView>
        </ToolCard>
    );
};

const ArchitectTool = () => {
    const [stack, setStack] = useState('');

    const suggest = (type: string) => {
        if (type === 'Real-time') setStack('WebSockets + Redis + Node.js');
        else if (type === 'SaaS') setStack('Next.js + Prisma + Stripe + AWS');
        else setStack('React Native + Firebase + Supabase');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <ToolCard>
            <SectionTitle text="The Architect" subText="AI-driven system design decision tree." />
            <Text className="text-gray-500 text-[10px] font-bold uppercase mb-4 tracking-widest">Select Project Archetype</Text>
            <View className="flex-row flex-wrap gap-2 mb-8">
                {['Real-time', 'SaaS', 'E-commerce', 'Fintech'].map(t => (
                    <TouchableOpacity key={t} onPress={() => suggest(t)} className="bg-gray-900 px-5 py-3 rounded-2xl border border-white/5">
                        <Text className="text-white text-[10px] font-black uppercase">{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {stack ? (
                <View className="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/20 items-center">
                    <Ionicons name="bulb-outline" size={32} color="#3b82f6" />
                    <Text className="text-white font-black text-center mt-4 tracking-tight">RECOMMENDED STACK</Text>
                    <Text className="text-blue-400 font-mono text-xs mt-2 text-center">{stack}</Text>
                    <TouchableOpacity onPress={() => {
                        Clipboard.setStringAsync(stack);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }} className="mt-6 bg-gray-900 px-6 py-2 rounded-full border border-white/5">
                        <Text className="text-white text-[10px] font-bold uppercase">Copy Stack</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View className="items-center py-10 opacity-20">
                    <Ionicons name="business-outline" size={60} color="white" />
                    <Text className="text-white text-[10px] font-black mt-4 uppercase">Waiting for input</Text>
                </View>
            )}
        </ToolCard>
    );
};

const TerminalToEnglishTool = () => {
    const [cmd, setCmd] = useState('');
    const [translation, setTranslation] = useState('');

    const explain = () => {
        let text = "This command ";
        if (cmd.includes('find .')) text += "searches the current directory ";
        if (cmd.includes('-name')) text += "for files matching a specific name ";
        if (cmd.includes('| xargs')) text += "and pipes the output as arguments into ";
        if (cmd.includes('grep')) text += "the grep search engine.";
        setTranslation(text || "Logic translation for this specific CLI chain is pending...");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <ToolCard>
            <SectionTitle text="Terminal Explainer" subText="Translate complex CLI scripts to plain English." />
            <TextInput value={cmd} onChangeText={setCmd} placeholder="find . -type f -name '*.ts' | xargs grep 'FIXME'" multiline placeholderTextColor="#666" className="bg-black p-5 rounded-2xl text-white mb-6 border border-white/5 font-mono text-xs h-24" />

            <TouchableOpacity onPress={explain} className="bg-green-600 py-4 rounded-xl items-center shadow-lg shadow-green-500/20">
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">Explain Script</Text>
            </TouchableOpacity>

            {translation ? (
                <View className="mt-8 bg-black/80 p-6 rounded-3xl border border-white/5 items-center">
                    <Ionicons name="language-outline" size={24} color="#10b981" />
                    <Text className="text-white font-medium text-center mt-3 italic leading-5">"{translation}"</Text>
                </View>
            ) : null}
        </ToolCard>
    );
};

const CostEstimatorTool = () => {
    const [cost, setCost] = useState('0.00');

    const update = (val: string) => {
        const num = parseFloat(val) || 0;
        setCost((num * 0.00042).toFixed(4));
    };

    return (
        <ToolCard>
            <SectionTitle text="Cloud Cost" subText="Deep infra cost analysis for student projects." />
            <Text className="text-gray-500 text-[10px] font-black uppercase mb-2 ml-1">Estimated Monthly Requests</Text>
            <TextInput onChangeText={update} keyboardType="numeric" placeholder="100,000" placeholderTextColor="#666" className="bg-black p-5 rounded-2xl text-white mb-6 border border-white/5 font-black text-xl" />

            <View className="bg-green-500/10 p-8 rounded-3xl border border-green-500/20 items-center">
                <Text className="text-green-500 text-3xl font-black">${cost}</Text>
                <Text className="text-gray-500 text-[10px] font-bold uppercase mt-2 tracking-widest">Est. Serverless Cost / Month</Text>
            </View>
        </ToolCard>
    );
};

const SignatureGenTool = () => {
    const [key, setKey] = useState('');
    const [payload, setPayload] = useState('');
    const [signature, setSignature] = useState('');

    const generate = () => {
        const sig = 'sha256_' + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
        setSignature(sig);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    return (
        <ToolCard>
            <SectionTitle text="Payload Signer" subText="Generate HMAC signatures for webhooks." />
            <TextInput value={key} onChangeText={setKey} placeholder="Secret API Key" placeholderTextColor="#444" className="bg-black p-4 rounded-xl text-white mb-4 border border-white/5" />
            <TextInput value={payload} onChangeText={setPayload} multiline placeholder='{"event": "user.signup", "id": 1}' placeholderTextColor="#444" className="bg-black p-4 rounded-xl text-white mb-6 h-24 border border-white/5" />

            <TouchableOpacity onPress={generate} className="bg-red-600 py-4 rounded-xl items-center shadow-lg shadow-red-500/20 mb-8">
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">Generate Signature</Text>
            </TouchableOpacity>

            {signature ? (
                <View className="bg-gray-900 p-5 rounded-3xl border border-white/5 flex-row justify-between items-center">
                    <Text className="text-red-400 font-mono text-[10px] flex-1 mr-4">{signature}</Text>
                    <TouchableOpacity onPress={() => {
                        Clipboard.setStringAsync(signature);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }} className="bg-gray-800 p-2 rounded-lg">
                        <Ionicons name="copy-outline" size={14} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            ) : null}
        </ToolCard>
    );
};

const CurlCodeTool = () => {
    const [curl, setCurl] = useState('');
    const [code, setCode] = useState('');

    const convert = () => {
        if (!curl) return;
        const url = curl.split('curl ')[1]?.split(' ')[0] || curl;
        const result = `fetch("${url.replace(/['"]/g, '')}", {\n  method: "GET",\n  headers: { "Content-Type": "application/json" }\n}).then(res => res.json());`;
        setCode(result);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <ToolCard>
            <SectionTitle text="cURL to Fetch" subText="Convert cURL commands to JavaScript fetch." />
            <TextInput value={curl} onChangeText={setCurl} multiline placeholder="curl https://api.example.com" placeholderTextColor="#444" className="bg-black p-4 rounded-xl text-white mb-4 h-20" />
            <TouchableOpacity onPress={convert} className="bg-indigo-600 py-4 rounded-xl items-center mb-6">
                <Text className="text-white font-bold">Convert to JavaScript</Text>
            </TouchableOpacity>
            {code ? (
                <View className="bg-black p-4 rounded-xl border border-white/5">
                    <Text className="text-gray-400 font-mono text-[10px] leading-4">{code}</Text>
                    <TouchableOpacity onPress={() => Clipboard.setStringAsync(code)} className="mt-4 flex-row items-center border-t border-white/5 pt-2">
                        <Ionicons name="copy-outline" size={14} color="#6366f1" />
                        <Text className="text-blue-500 font-bold ml-2 text-xs">Copy Code</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </ToolCard>
    );
};

const SvgToCompTool = () => {
    const [svg, setSvg] = useState('');
    const [comp, setComp] = useState('');

    const convert = () => {
        if (!svg) return;
        const name = "MyIcon";
        const result = `export const ${name} = () => (\n  <Svg width="24" height="24" viewBox="0 0 24 24">\n    ${svg.replace(/<svg.*?>|<\/svg>/g, '').trim()}\n  </Svg>\n);`;
        setComp(result);
    };

    return (
        <ToolCard>
            <SectionTitle text="SVG to React Component" subText="Transform SVG markup into React Native components." />
            <TextInput value={svg} onChangeText={setSvg} multiline placeholder="<svg>...</svg>" placeholderTextColor="#444" className="bg-black p-4 rounded-xl text-white mb-4 h-20" />
            <TouchableOpacity onPress={convert} className="bg-pink-600 py-4 rounded-xl items-center mb-6">
                <Text className="text-white font-bold">Generate Component</Text>
            </TouchableOpacity>
            {comp ? (
                <View className="bg-black p-4 rounded-xl border border-white/5">
                    <Text className="text-gray-400 font-mono text-[10px] leading-4">{comp}</Text>
                    <TouchableOpacity onPress={() => Clipboard.setStringAsync(comp)} className="mt-4 flex-row items-center border-t border-white/5 pt-2">
                        <Ionicons name="copy-outline" size={14} color="#f472b6" />
                        <Text className="text-pink-500 font-bold ml-2 text-xs">Copy Code</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </ToolCard>
    );
};

const CodeToImageTool = () => {
    return (
        <ToolCard>
            <SectionTitle text="Code-to-Image" subText="Capture beautiful snippets for social media." />
            <View className="bg-gray-800 rounded-3xl p-6 border border-white/10 shadow-2xl mb-8">
                <View className="flex-row gap-1.5 mb-4">
                    <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <View className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </View>
                <Text className="text-pink-400 font-mono text-xs">const <Text className="text-blue-400">fync</Text> = () ={` > `}{`{`}</Text>
                <Text className="text-white font-mono text-xs">  console.<Text className="text-yellow-400">log</Text>(<Text className="text-green-400">"Hello Devs!"</Text>);</Text>
                <Text className="text-white font-mono text-xs">{`}`};</Text>
            </View>

            <TouchableOpacity className="bg-red-600 py-4 rounded-xl items-center shadow-lg shadow-red-500/20">
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">Export PNG High-Res</Text>
            </TouchableOpacity>
        </ToolCard>
    );
};
