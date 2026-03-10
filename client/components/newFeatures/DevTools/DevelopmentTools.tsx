import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ToolCard, SectionTitle } from './Common';
import { REGEX_LIB } from './Constants';

export const RegexTool = React.memo(() => {
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
});

export const ReadMeTool = React.memo(() => {
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
});

export const SqlToNoSqlTool = React.memo(() => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [mode, setMode] = useState<'sql-nosql' | 'nosql-sql'>('sql-nosql');

    const translate = () => {
        if (!input.trim()) return;
        let result = '';

        if (mode === 'sql-nosql') {
            const text = input.trim().toLowerCase();
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
                <ScrollView className="max-h-[200px]">
                    <Text className="text-pink-500 font-mono text-xs leading-5">{output || "// Translated code will appear here."}</Text>
                </ScrollView>
            </View>
        </ToolCard>
    );
});

export const TypeGenTool = React.memo(() => {
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
});

export const ContractScaffoldTool = React.memo(() => {
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
});

export const CurlCodeTool = React.memo(() => {
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
});

export const MockTool = React.memo(() => {
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
});

export const SvgToCompTool = React.memo(() => {
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
});
