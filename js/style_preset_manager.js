import { app } from "../../../scripts/app.js";
import { t, isPresetSwitcherStyle } from "./i18n.js";

// API调用工具函数
const api = {
    async getPresets() {
        try {
            const resp = await fetch("/preset-switcher/presets");
            const data = await resp.json();
            return data.presets || [];
        } catch (e) {
            console.error("获取预设列表失败", e);
            return [];
        }
    },
    
    async savePreset(filename, presetData) {
        try {
            await fetch("/preset-switcher/presets/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename, preset: presetData })
            });
            return true;
        } catch (e) {
            console.error("保存预设失败", e);
            return false;
        }
    },
    
    async deletePreset(filename) {
        try {
            await fetch("/preset-switcher/presets/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename })
            });
            return true;
        } catch (e) {
            console.error("删除预设失败", e);
            return false;
        }
    }
};

// 获取当前工作流名�?const getWorkflowName = () => {
    try {
        const workflowName = app.graph.name || "默认工作�?;
        return workflowName.replace(/[<>:"/\\|?*]/g, '_');
    } catch (e) {
        return "默认工作�?;
    }
};

// 工具函数：创建下载文�?const downloadJSON = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

// 工具函数：文件选择
const selectJSONFile = () => {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        resolve(data);
                    } catch (e) {
                        resolve(null);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    });
};

app.registerExtension({
    name: "PresetSwitcher.StylePresetManager",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (isPresetSwitcherStyle(nodeData.name)) {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = async function() {
                if (onNodeCreated) {
                    onNodeCreated.apply(this, arguments);
                }
                
                this.currentPresetName = "预设1";
                this.presets = {};
                
                this.setupWidgetUI();
                await this.loadPresetsFromServer();
            };
            
            // 保存节点状态到工作�?            nodeType.prototype.onSerialize = function(o) {
                o.preset_switcher_style_data = {
                    currentPresetName: this.currentPresetName,
                    modelNodeValue: this.modelNodeWidget?.value,
                    loraNodeValue: this.loraNodeWidget?.value,
                    positiveValue: this.positiveWidget?.value,
                    negativeValue: this.negativeWidget?.value
                };
            };
            
            // 从工作流加载节点状�?            nodeType.prototype.onConfigure = function(o) {
                if (o.preset_switcher_style_data) {
                    if (o.preset_switcher_style_data.currentPresetName) {
                        this.currentPresetName = o.preset_switcher_style_data.currentPresetName;
                    }
                }
                
                // 确保widget引用在onConfigure之后也能正确绑定
                setTimeout(() => {
                    this.setupWidgetUI();
                    // 更新预设选择框的�?                    if (this.presetSelectWidget) {
                        this.presetSelectWidget.value = this.currentPresetName;
                    }
                }, 100);
            };
            
            // 初始化UI
            nodeType.prototype.setupWidgetUI = function() {
                // 不要清空widgets数组，只在原有基础上添�?                // 避免删除节点可能需要的内部widget
                
                // 检查是否已经添加过我们的widget，避免重复添�?                let existingWidgets = {};
                for (const w of (this.widgets || [])) {
                    if (w.name) {
                        existingWidgets[w.name] = w;
                    }
                }
                
                const hasOurWidgets = existingWidgets["保存当前配置"] || existingWidgets["预设选择"] ||
                    existingWidgets[t('savePreset')] || existingWidgets[t('presetSelect')];
                
                if (hasOurWidgets) {
                    console.log('【调试】widget已存在，重新绑定引用');
                    // 如果widget已存在，重新找到它们并赋值给引用
                    this.presetSelectWidget = existingWidgets["预设选择"] || existingWidgets[t('presetSelect')];
                    this.modelNodeWidget = existingWidgets["模型"] || existingWidgets[t('model')];
                    this.loraNodeWidget = existingWidgets["LoRA�?];
                    this.positiveWidget = existingWidgets["正向提示�?] || existingWidgets[t('positivePrompt')];
                    this.negativeWidget = existingWidgets["反向提示�?] || existingWidgets[t('negativePrompt')];
                    return;
                }
                
                this.addWidget("button", t('savePreset'), null, () => {
                    this.saveCurrentConfig();
                });
                
                this.addWidget("button", t('more'), null, () => {
                    this.showPresetManager();
                });
                
                this.presetSelectWidget = this.addWidget("combo", t('presetSelect'), this.currentPresetName, (v) => {
                    console.log('【调试】用户选择预设:', v);
                    console.log('【调试】当前所有预�?', this.presets);
                    this.currentPresetName = v;
                    this.applyPreset(v);
                }, {
                    values: () => Object.keys(this.presets)
                });
                
                this.modelNodeWidget = this.addWidget("combo", t('model'), "", () => {}, {
                    values: () => this.getNodeOptions('CheckpointLoader')
                });
                
                this.loraNodeWidget = this.addWidget("combo", "LoRA�?, "", () => {}, {
                    values: () => this.getNodeOptions('LoRA')
                });
                
                this.positiveWidget = this.addWidget("combo", t('positivePrompt'), "", () => {}, {
                    values: () => this.getNodeOptions('CLIPTextEncode')
                });
                
                this.negativeWidget = this.addWidget("combo", t('negativePrompt'), "", () => {}, {
                    values: () => this.getNodeOptions('CLIPTextEncode')
                });
            };
            
            // 从服务器加载预设
            nodeType.prototype.loadPresetsFromServer = async function() {
                console.log('【调试】loadPresetsFromServer 开始，当前预设�?', this.currentPresetName);
                const serverPresets = await api.getPresets();
                
                const oldPresetName = this.currentPresetName;
                
                this.presets = {};
                for (const preset of serverPresets) {
                    // 只加载带�?[效率] 前缀的预�?                    if (preset.filename && preset.filename.startsWith('[效率]') && preset.name) {
                        this.presets[preset.name] = preset;
                    }
                }
                
                if (Object.keys(this.presets).length === 0) {
                    this.presets["预设1"] = {
                        name: "预设1",
                        version: 1
                    };
                }
                
                // 如果旧的预设名还存在，就继续用它；否则用第一�?                if (this.presets[oldPresetName]) {
                    this.currentPresetName = oldPresetName;
                    console.log('【调试】保留原预设�?', oldPresetName);
                } else {
                    this.currentPresetName = Object.keys(this.presets)[0];
                    console.log('【调试】原预设名不存在，改用第一个预�?', this.currentPresetName);
                }
                
                this.updatePresetList();
            };
            
            // 更新预设列表
            nodeType.prototype.updatePresetList = function() {
                if (this.presetSelectWidget) {
                    this.presetSelectWidget.value = this.currentPresetName;
                }
            };
            
            // 获取节点选择�?            nodeType.prototype.getNodeOptions = function(typeFilter) {
                const options = [""];
                for (const node of app.graph._nodes) {
                    if (node.type.includes(typeFilter) || (node.title && node.title.includes(typeFilter))) {
                        const id = node.id;
                        const title = node.title || node.type;
                        options.push(title + " (#" + id + ")");
                    }
                }
                return options;
            };
            
            // 从选项中获取节�?            nodeType.prototype.getNodeFromOption = function(option) {
                if (!option) return null;
                const match = option.match(/\(#(\d+)\)/);
                if (!match) return null;
                const id = parseInt(match[1]);
                for (const node of app.graph._nodes) {
                    if (node.id === id) return node;
                }
                return null;
            };
            
            // 保存当前配置
            nodeType.prototype.saveCurrentConfig = async function() {
                console.log('【调试�?========= 开始保存预�?==========');
                console.log('【调试】this.modelNodeWidget:', this.modelNodeWidget);
                console.log('【调试】this.modelNodeWidget.value:', this.modelNodeWidget?.value);
                console.log('【调试】this.loraNodeWidget.value:', this.loraNodeWidget?.value);
                console.log('【调试】this.positiveWidget.value:', this.positiveWidget?.value);
                console.log('【调试】this.negativeWidget.value:', this.negativeWidget?.value);
                
                const preset = {
                    name: this.currentPresetName,
                    version: 1,
                    timestamp: Date.now(),
                    model: null,
                    lora_stack: null,
                    positive_prompt: null,
                    negative_prompt: null
                };
                
                // 读取模型节点
                const modelNode = this.getNodeFromOption(this.modelNodeWidget?.value);
                console.log('【调试】找到的模型节点:', modelNode);
                if (modelNode) {
                    const widget = modelNode.widgets?.find(w => w.name === 'ckpt_name');
                    if (widget) {
                        preset.model = {
                            node_id: modelNode.id,
                            value: widget.value
                        };
                        console.log('【调试】保存模型配�?', preset.model);
                    }
                }
                
                // 读取LoRA堆节�?                const loraNode = this.getNodeFromOption(this.loraNodeWidget?.value);
                console.log('【调试】找到的LoRA节点:', loraNode);
                if (loraNode) {
                    const loraData = this.readLORAStack(loraNode);
                    if (loraData) {
                        preset.lora_stack = loraData;
                        console.log('【调试】保存LoRA配置:', preset.lora_stack);
                    }
                }
                
                // 读取提示�?                const positiveNode = this.getNodeFromOption(this.positiveWidget?.value);
                console.log('【调试】找到的正向提示词节�?', positiveNode);
                if (positiveNode) {
                    const widget = positiveNode.widgets?.find(w => w.name === 'text');
                    if (widget) {
                        preset.positive_prompt = {
                            node_id: positiveNode.id,
                            value: widget.value
                        };
                        console.log('【调试】保存正向提示词:', preset.positive_prompt);
                    }
                }
                
                const negativeNode = this.getNodeFromOption(this.negativeWidget?.value);
                console.log('【调试】找到的反向提示词节�?', negativeNode);
                if (negativeNode) {
                    const widget = negativeNode.widgets?.find(w => w.name === 'text');
                    if (widget) {
                        preset.negative_prompt = {
                            node_id: negativeNode.id,
                            value: widget.value
                        };
                        console.log('【调试】保存反向提示词:', preset.negative_prompt);
                    }
                }
                
                this.presets[this.currentPresetName] = preset;
                console.log('【调试】完整预设数�?', preset);
                console.log('【调试�?========= 保存预设完成 ==========');
                
                // 保存到服务器 - 加上 [效率] 前缀
                const workflowName = getWorkflowName();
                const filename = `[效率]_${workflowName}_${this.currentPresetName}.json`;
                console.log('【调试】保存文件名:', filename);
                await api.savePreset(filename, preset);
                
                console.log(`�?已保存到 ${this.currentPresetName}！`);
                await this.loadPresetsFromServer();
            };
            
            // 读取LoRA堆节�?            nodeType.prototype.readLORAStack = function(node) {
                const widgets = node.widgets || [];
                
                // 获取输入模式
                const modeWidget = widgets.find(w => w.name === 'input_mode');
                const mode = modeWidget?.value || 'simple';
                
                // 获取LoRA数量
                const countWidget = widgets.find(w => w.name === 'lora_count');
                const count = countWidget?.value || 3;
                
                const loras = [];
                
                for (let i = 0; i < count; i++) {
                    const num = i + 1;
                    const loraWidget = widgets.find(w => w.name === `lora_name_${num}`);
                    
                    if (!loraWidget) continue;
                    
                    const loraData = {
                        name: loraWidget.value
                    };
                    
                    if (mode === 'simple') {
                        const weightWidget = widgets.find(w => w.name === `lora_wt_${num}`);
                        loraData.weight = weightWidget?.value || 1.0;
                    } else {
                        const modelStrWidget = widgets.find(w => w.name === `model_str_${num}`);
                        const clipStrWidget = widgets.find(w => w.name === `clip_str_${num}`);
                        loraData.model_strength = modelStrWidget?.value || 1.0;
                        loraData.clip_strength = clipStrWidget?.value || 1.0;
                    }
                    
                    loras.push(loraData);
                }
                
                return {
                    node_id: node.id,
                    mode: mode,
                    count: count,
                    loras: loras
                };
            };
            
            // 应用预设
            nodeType.prototype.applyPreset = function(presetName) {
                console.log('【调试】applyPreset 被调用，预设�?', presetName);
                const preset = this.presets[presetName];
                console.log('【调试】读取到的预设数�?', preset);
                if (!preset) {
                    console.error('【调试】预设不存在�?);
                    alert(t('presetNotExist'));
                    return;
                }
                
                // 收集应用结果，最后给用户一个总结
                const results = {
                    success: [],
                    warning: [],
                    error: []
                };
                
                // 优先�?：LoRA堆（最复杂，需要按正确顺序�?                if (preset.lora_stack) {
                    console.log('【调试】找到LoRA配置，开始应�?);
                    let loraNode = this.getNodeFromOption(this.loraNodeWidget.value);
                    console.log('【调试】从下拉菜单找到的LoRA节点:', loraNode);
                    if (!loraNode && preset.lora_stack.node_id) {
                        console.log('【调试】尝试从节点ID查找:', preset.lora_stack.node_id);
                        for (const node of app.graph._nodes) {
                            if (node.id === preset.lora_stack.node_id) {
                                loraNode = node;
                                break;
                            }
                        }
                    }
                    console.log('【调试】最终找到的LoRA节点:', loraNode);
                    
                    if (loraNode) {
                        console.log('【调试】开始应用LoRA配置');
                        this.applyLORAStack(loraNode, preset.lora_stack);
                        results.success.push('�?LoRA配置已应�?);
                    } else {
                        results.warning.push('⚠️ 找不到LoRA堆节点，请在下拉菜单中重新选择');
                    }
                }
                
                // 优先�?：模�?                if (preset.model) {
                    console.log('【调试】找到模型配置，开始应�?);
                    let modelNode = this.getNodeFromOption(this.modelNodeWidget.value);
                    console.log('【调试】从下拉菜单找到的模型节�?', modelNode);
                    if (!modelNode && preset.model.node_id) {
                        console.log('【调试】尝试从节点ID查找:', preset.model.node_id);
                        for (const node of app.graph._nodes) {
                            if (node.id === preset.model.node_id) {
                                modelNode = node;
                                break;
                            }
                        }
                    }
                    console.log('【调试】最终找到的模型节点:', modelNode);
                    
                    if (modelNode) {
                        const widget = modelNode.widgets?.find(w => w.name === 'ckpt_name');
                        if (widget) {
                            console.log('【调试】设置模�?', preset.model.value);
                            
                            // 检查模型文件是否在选项中（安全检查）
                            if (widget.options && Array.isArray(widget.options) && !widget.options.includes(preset.model.value)) {
                                results.warning.push(`⚠️ 模型文件 "${preset.model.value}" 可能已改名或不存在，已尝试设置`);
                            }
                            
                            widget.value = preset.model.value;
                            modelNode.onWidgetChange?.(widget);
                            results.success.push('�?模型配置已应�?);
                        }
                    } else {
                        results.warning.push('⚠️ 找不到模型节点，请在下拉菜单中重新选择');
                    }
                }
                
                // 优先�?：提示词
                if (preset.positive_prompt) {
                    console.log('【调试】找到正向提示词配置');
                    let positiveNode = this.getNodeFromOption(this.positiveWidget.value);
                    if (!positiveNode && preset.positive_prompt.node_id) {
                        for (const node of app.graph._nodes) {
                            if (node.id === preset.positive_prompt.node_id) {
                                positiveNode = node;
                                break;
                            }
                        }
                    }
                    
                    if (positiveNode) {
                        const widget = positiveNode.widgets?.find(w => w.name === 'text');
                        if (widget) {
                            console.log('【调试】设置正向提示词:', preset.positive_prompt.value);
                            widget.value = preset.positive_prompt.value;
                            results.success.push('�?正向提示词已应用');
                        }
                    } else {
                        results.warning.push('⚠️ 找不到正向提示词节点，请在下拉菜单中重新选择');
                    }
                }
                
                if (preset.negative_prompt) {
                    console.log('【调试】找到反向提示词配置');
                    let negativeNode = this.getNodeFromOption(this.negativeWidget.value);
                    if (!negativeNode && preset.negative_prompt.node_id) {
                        for (const node of app.graph._nodes) {
                            if (node.id === preset.negative_prompt.node_id) {
                                negativeNode = node;
                                break;
                            }
                        }
                    }
                    
                    if (negativeNode) {
                        const widget = negativeNode.widgets?.find(w => w.name === 'text');
                        if (widget) {
                            console.log('【调试】设置反向提示词:', preset.negative_prompt.value);
                            widget.value = preset.negative_prompt.value;
                            results.success.push('�?反向提示词已应用');
                        }
                    } else {
                        results.warning.push('⚠️ 找不到反向提示词节点，请在下拉菜单中重新选择');
                    }
                }
                
                // 显示总结信息
                const message = [
                    `预设 "${presetName}" 切换完成！`,
                    '',
                    ...results.success,
                    ...results.warning,
                    ...results.error
                ].join('\n');
                
                console.log(message);
                
                // 只有警告或错误时才弹�?                if (results.warning.length > 0 || results.error.length > 0) {
                    const warningMessage = [
                        `预设 "${presetName}" 切换完成，但有问题需要注意：`,
                        '',
                        ...results.warning,
                        ...results.error
                    ].join('\n');
                    alert(warningMessage);
                }
            };
            
            // 应用LoRA�?            nodeType.prototype.applyLORAStack = function(node, loraData) {
                console.log('【调试】开始应用LoRA配置:', loraData);
                
                const widgets = node.widgets || [];
                
                // 关键：找到widget并设置值，通过设置器触发widget变更逻辑
                function setWidgetValue(widgetName, value) {
                    const widget = widgets.find(w => w.name === widgetName);
                    if (widget) {
                        console.log(`【调试】设�?${widgetName} = ${value}`);
                        // 通过widget的setter设置值，这样会触发widgethider的逻辑
                        widget.value = value;
                        return true;
                    }
                    console.log(`【调试】未找到widget: ${widgetName}`);
                    return false;
                }
                
                // 步骤1：先设置输入模式（触发widgethider�?                setWidgetValue('input_mode', loraData.mode);
                
                // 步骤2：设置LoRA数量（触发widgethider显示对应数量的widget�?                setWidgetValue('lora_count', loraData.count);
                
                // 步骤3：设置每个LoRA
                for (let i = 0; i < loraData.loras.length; i++) {
                    const num = i + 1;
                    const loraInfo = loraData.loras[i];
                    
                    console.log(`【调试】设置LoRA${num}:`, loraInfo);
                    
                    // 设置LoRA名称
                    setWidgetValue(`lora_name_${num}`, loraInfo.name);
                    
                    if (loraData.mode === 'simple') {
                        // simple模式：设置lora_wt
                        setWidgetValue(`lora_wt_${num}`, loraInfo.weight);
                    } else {
                        // advanced模式：设置model_str和clip_str
                        setWidgetValue(`model_str_${num}`, loraInfo.model_strength);
                        setWidgetValue(`clip_str_${num}`, loraInfo.clip_strength);
                    }
                }
                
                console.log('【调试】LoRA配置应用完成');
            };
            
            // 自定义输入弹�?            nodeType.prototype.showInputDialog = function(title, placeholder, defaultValue) {
                return new Promise((resolve) => {
                    const dialog = document.createElement('div');
                    dialog.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.7);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2000;
                    `;
                    
                    const dialogBox = document.createElement('div');
                    dialogBox.style.cssText = `
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 8px;
                        padding: 20px;
                        min-width: 400px;
                    `;
                    
                    const dialogTitle = document.createElement('div');
                    dialogTitle.textContent = title;
                    dialogTitle.style.color = '#fff';
                    dialogTitle.style.marginBottom = '16px';
                    dialogTitle.style.fontSize = '16px';
                    dialogTitle.style.fontWeight = 'bold';
                    dialogBox.appendChild(dialogTitle);
                    
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.placeholder = placeholder || '';
                    input.value = defaultValue || '';
                    input.style.cssText = `
                        width: 100%;
                        padding: 10px;
                        background: #1a1a1a;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        margin-bottom: 16px;
                        box-sizing: border-box;
                        font-size: 14px;
                    `;
                    dialogBox.appendChild(input);
                    
                    const btnArea = document.createElement('div');
                    btnArea.style.cssText = `
                        display: flex;
                        gap: 8px;
                    `;
                    dialogBox.appendChild(btnArea);
                    
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = t('cancel');
                    cancelBtn.style.cssText = `
                        flex: 1;
                        padding: 10px;
                        background: #444;
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    `;
                    cancelBtn.addEventListener('click', () => {
                        document.body.removeChild(dialog);
                        resolve(null);
                    });
                    btnArea.appendChild(cancelBtn);
                    
                    const confirmBtn = document.createElement('button');
                    confirmBtn.textContent = t('confirm');
                    confirmBtn.style.cssText = `
                        flex: 1;
                        padding: 10px;
                        background: #2196F3;
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    `;
                    confirmBtn.addEventListener('click', () => {
                        const value = input.value.trim();
                        document.body.removeChild(dialog);
                        resolve(value || null);
                    });
                    btnArea.appendChild(confirmBtn);
                    
                    dialog.appendChild(dialogBox);
                    document.body.appendChild(dialog);
                    
                    // 聚焦到输入框
                    setTimeout(() => input.focus(), 10);
                    
                    // 回车确认，ESC取消
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            confirmBtn.click();
                        } else if (e.key === 'Escape') {
                            cancelBtn.click();
                        }
                    });
                });
            };
            
            // 自定义确认弹�?            nodeType.prototype.showConfirmDialog = function(message) {
                return new Promise((resolve) => {
                    const dialog = document.createElement('div');
                    dialog.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.7);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2000;
                    `;
                    
                    const dialogBox = document.createElement('div');
                    dialogBox.style.cssText = `
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 8px;
                        padding: 20px;
                        min-width: 400px;
                    `;
                    
                    const dialogTitle = document.createElement('div');
                    dialogTitle.textContent = message;
                    dialogTitle.style.color = '#fff';
                    dialogTitle.style.marginBottom = '16px';
                    dialogTitle.style.fontSize = '14px';
                    dialogBox.appendChild(dialogTitle);
                    
                    const btnArea = document.createElement('div');
                    btnArea.style.cssText = `
                        display: flex;
                        gap: 8px;
                    `;
                    dialogBox.appendChild(btnArea);
                    
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = t('cancel');
                    cancelBtn.style.cssText = `
                        flex: 1;
                        padding: 10px;
                        background: #444;
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    `;
                    cancelBtn.addEventListener('click', () => {
                        document.body.removeChild(dialog);
                        resolve(false);
                    });
                    btnArea.appendChild(cancelBtn);
                    
                    const confirmBtn = document.createElement('button');
                    confirmBtn.textContent = t('confirm');
                    confirmBtn.style.cssText = `
                        flex: 1;
                        padding: 10px;
                        background: #f44336;
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    `;
                    confirmBtn.addEventListener('click', () => {
                        document.body.removeChild(dialog);
                        resolve(true);
                    });
                    btnArea.appendChild(confirmBtn);
                    
                    dialog.appendChild(dialogBox);
                    document.body.appendChild(dialog);
                });
            };
            
            // 预设管理弹窗
            nodeType.prototype.showPresetManager = function() {
                const menu = document.createElement('div');
                menu.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #2a2a2a;
                    border: 1px solid #444;
                    border-radius: 8px;
                    padding: 20px;
                    z-index: 1000;
                    min-width: 600px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                `;
                
                const title = document.createElement('h2');
                title.textContent = t('presetManager');
                title.style.color = '#fff';
                title.style.margin = '0 0 16px 0';
                title.style.fontSize = '18px';
                title.style.fontWeight = 'bold';
                menu.appendChild(title);
                
                const content = document.createElement('div');
                content.style.display = 'grid';
                content.style.gridTemplateColumns = '200px 1fr';
                content.style.gap = '16px';
                menu.appendChild(content);
                
                const listArea = document.createElement('div');
                listArea.style.display = 'flex';
                listArea.style.flexDirection = 'column';
                listArea.style.gap = '6px';
                listArea.style.maxHeight = '400px';
                listArea.style.overflowY = 'auto';
                content.appendChild(listArea);
                
                const detailArea = document.createElement('div');
                detailArea.style.display = 'flex';
                detailArea.style.flexDirection = 'column';
                detailArea.style.gap = '8px';
                content.appendChild(detailArea);
                
                const refreshUI = () => {
                    listArea.innerHTML = '';
                    
                    const addBtn = document.createElement('button');
                    addBtn.textContent = t('addPreset');
                    addBtn.style.padding = '8px 12px';
                    addBtn.style.background = '#4a4a4a';
                    addBtn.style.color = '#fff';
                    addBtn.style.border = '1px solid #666';
                    addBtn.style.borderRadius = '4px';
                    addBtn.style.cursor = 'pointer';
                    addBtn.style.fontSize = '13px';
                    addBtn.addEventListener('click', async () => {
                        const name = await this.showInputDialog(t('addPreset'), t('inputPresetName'), '');
                        if (name) {
                            const newPreset = {
                                name: name,
                                version: 1
                            };
                            this.presets[name] = newPreset;
                            this.currentPresetName = name;
                            // 保存到后�?- 加上 [效率] 前缀
                            const workflowName = getWorkflowName();
                            const filename = `[效率]_${workflowName}_${name}.json`;
                            await api.savePreset(filename, newPreset);
                            await this.loadPresetsFromServer();
                            refreshUI();
                        }
                    });
                    listArea.appendChild(addBtn);
                    
                    for (const name of Object.keys(this.presets)) {
                        const btn = document.createElement('button');
                        btn.textContent = name;
                        btn.style.padding = '8px 12px';
                        btn.style.background = name === this.currentPresetName ? '#2196F3' : '#3a3a3a';
                        btn.style.color = '#fff';
                        btn.style.border = name === this.currentPresetName ? '1px solid #2196F3' : '1px solid #555';
                        btn.style.borderRadius = '4px';
                        btn.style.cursor = 'pointer';
                        btn.style.textAlign = 'left';
                        btn.style.fontSize = '13px';
                        btn.addEventListener('click', () => {
                            this.currentPresetName = name;
                            this.updatePresetList();
                            refreshUI();
                        });
                        listArea.appendChild(btn);
                    }
                    
                    detailArea.innerHTML = '';
                    const preset = this.presets[this.currentPresetName];
                    if (!preset) return;
                    
                    const nameLabel = document.createElement('div');
                    nameLabel.textContent = t('presetName');
                    nameLabel.style.color = '#aaa';
                    nameLabel.style.fontSize = '12px';
                    nameLabel.style.marginBottom = '4px';
                    detailArea.appendChild(nameLabel);
                    
                    const nameDisplay = document.createElement('div');
                    nameDisplay.textContent = preset.name;
                    nameDisplay.style.color = '#fff';
                    nameDisplay.style.fontSize = '14px';
                    nameDisplay.style.padding = '8px 12px';
                    nameDisplay.style.background = '#1a1a1a';
                    nameDisplay.style.border = '1px solid #444';
                    nameDisplay.style.borderRadius = '4px';
                    nameDisplay.style.marginBottom = '12px';
                    detailArea.appendChild(nameDisplay);
                    
                    const buttonsArea = document.createElement('div');
                    buttonsArea.style.display = 'flex';
                    buttonsArea.style.gap = '8px';
                    buttonsArea.style.marginBottom = '16px';
                    detailArea.appendChild(buttonsArea);
                    
                    const renameBtn = document.createElement('button');
                    renameBtn.textContent = t('rename');
                    renameBtn.style.padding = '8px 16px';
                    renameBtn.style.background = '#3a3a3a';
                    renameBtn.style.color = '#fff';
                    renameBtn.style.border = '1px solid #555';
                    renameBtn.style.borderRadius = '4px';
                    renameBtn.style.cursor = 'pointer';
                    renameBtn.style.flex = '1';
                    renameBtn.style.fontSize = '13px';
                    renameBtn.addEventListener('click', async () => {
                        const newName = await this.showInputDialog(t('renamePreset'), t('inputNewPresetName'), this.currentPresetName);
                        if (newName && newName !== this.currentPresetName) {
                            const oldPresetName = this.currentPresetName;
                            const oldData = this.presets[oldPresetName];
                            delete this.presets[oldPresetName];
                            oldData.name = newName;
                            this.presets[newName] = oldData;
                            this.currentPresetName = newName;
                            // 保存新预设，删除旧预�?                            const workflowName = getWorkflowName();
                            const oldFilename = `${workflowName}_${oldPresetName}.json`;
                            const newFilename = `${workflowName}_${newName}.json`;
                            await api.savePreset(newFilename, oldData);
                            await api.deletePreset(oldFilename);
                            await this.loadPresetsFromServer();
                            refreshUI();
                        }
                    });
                    buttonsArea.appendChild(renameBtn);
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = t('delete');
                    deleteBtn.style.padding = '8px 16px';
                    deleteBtn.style.background = '#f44336';
                    deleteBtn.style.color = '#fff';
                    deleteBtn.style.border = '1px solid #f44336';
                    deleteBtn.style.borderRadius = '4px';
                    deleteBtn.style.cursor = 'pointer';
                    deleteBtn.style.flex = '1';
                    deleteBtn.style.fontSize = '13px';
                    deleteBtn.addEventListener('click', async () => {
                        const confirmed = await this.showConfirmDialog(`确定删除预设 "${this.currentPresetName}" �?`);
                        if (confirmed) {
                            const workflowName = getWorkflowName();
                            const filename = `${workflowName}_${this.currentPresetName}.json`;
                            await api.deletePreset(filename);
                            delete this.presets[this.currentPresetName];
                            if (Object.keys(this.presets).length === 0) {
                                const defaultPreset = {
                                    name: '预设1',
                                    version: 1
                                };
                                this.presets['预设1'] = defaultPreset;
                                // 保存默认预设到后�?                                const defaultFilename = `${workflowName}_预设1.json`;
                                await api.savePreset(defaultFilename, defaultPreset);
                            }
                            this.currentPresetName = Object.keys(this.presets)[0];
                            await this.loadPresetsFromServer();
                            refreshUI();
                        }
                    });
                    buttonsArea.appendChild(deleteBtn);
                };
                
                const bottomArea = document.createElement('div');
                bottomArea.style.display = 'flex';
                bottomArea.style.gap = '8px';
                bottomArea.style.marginTop = '16px';
                bottomArea.style.borderTop = '1px solid #444';
                bottomArea.style.paddingTop = '16px';
                menu.appendChild(bottomArea);
                
                const importBtn = document.createElement('button');
                importBtn.textContent = t('importPreset');
                importBtn.style.padding = '8px 16px';
                importBtn.style.background = '#3a3a3a';
                importBtn.style.color = '#fff';
                importBtn.style.border = '1px solid #555';
                importBtn.style.borderRadius = '4px';
                importBtn.style.cursor = 'pointer';
                importBtn.style.flex = '1';
                importBtn.style.fontSize = '13px';
                importBtn.addEventListener('click', async () => {
                    const data = await selectJSONFile();
                    if (data && data.name) {
                        this.presets[data.name] = data;
                        this.currentPresetName = data.name;
                        await this.loadPresetsFromServer();
                        refreshUI();
                        console.log('�?导入成功�?);
                    } else {
                        console.log('�?导入失败�?);
                    }
                });
                bottomArea.appendChild(importBtn);
                
                const exportBtn = document.createElement('button');
                exportBtn.textContent = t('exportPreset');
                exportBtn.style.padding = '8px 16px';
                exportBtn.style.background = '#3a3a3a';
                exportBtn.style.color = '#fff';
                exportBtn.style.border = '1px solid #555';
                exportBtn.style.borderRadius = '4px';
                exportBtn.style.cursor = 'pointer';
                exportBtn.style.flex = '1';
                exportBtn.style.fontSize = '13px';
                exportBtn.addEventListener('click', () => {
                    const preset = this.presets[this.currentPresetName];
                    if (preset) {
                        const workflowName = getWorkflowName();
                        const filename = `${workflowName}_${this.currentPresetName}.json`;
                        downloadJSON(filename, preset);
                    }
                });
                bottomArea.appendChild(exportBtn);
                
                const closeBtn = document.createElement('button');
                closeBtn.textContent = t('close');
                closeBtn.style.padding = '8px 16px';
                closeBtn.style.background = '#3a3a3a';
                closeBtn.style.color = '#fff';
                closeBtn.style.border = '1px solid #555';
                closeBtn.style.borderRadius = '4px';
                closeBtn.style.cursor = 'pointer';
                closeBtn.style.flex = '1';
                closeBtn.style.fontSize = '13px';
                closeBtn.addEventListener('click', () => {
                    document.body.removeChild(menu);
                });
                bottomArea.appendChild(closeBtn);
                
                refreshUI();
                document.body.appendChild(menu);
            };
        }
    }
});
