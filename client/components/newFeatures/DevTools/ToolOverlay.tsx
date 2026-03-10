import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tool } from './Common';
import { RegexTool, ReadMeTool, SqlToNoSqlTool, TypeGenTool, ContractScaffoldTool, CurlCodeTool, SvgToCompTool, MockTool } from './DevelopmentTools';
import { APIPlaygroundTool } from './APIPlaygroundTool';
import { UnitConvertTool, GitMasterTool, LinuxMasterTool, TerminalToEnglishTool } from './UtilityTools';
import { FlexboxTool, CompressorTool, OGPreviewTool, CodeToImageTool, ContrastTool } from './DesignTools';
import { CommitGenTool, CronVisualizerTool, SLACalculatorTool, VaultTool, CostEstimatorTool, SignatureGenTool, ArchitectTool } from './DevOpsTools';

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
        case 'mock': return <MockTool />;
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

export const ToolOverlay = React.memo(({ tool, onClose }: { tool: Tool, onClose: () => void }) => {
    return (
        <SafeAreaView className="flex-1">
            <View className="flex-1 px-6">
                {/* Modal Header */}
                <View className="flex-row justify-between items-center py-4">
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: tool.color[0] }}>
                            <Ionicons name={tool.icon as any} size={20} color="white" />
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
});
