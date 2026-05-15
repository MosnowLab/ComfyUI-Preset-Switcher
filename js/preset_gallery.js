import { app } from "../../../scripts/app.js";
import { t, isPresetSwitcherNode, isPresetSwitcherStyle, isPresetGallery } from "./i18n.js";

const C = {
    overlay: 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:99999;',
    modal: 'background:#1a1a2e;border:1px solid #444;border-radius:14px;width:92%;max-width:1050px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 50px rgba(0,0,0,0.7);',
    header: 'display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid #333;',
    title: 'color:#4a90d9;margin:0;font-size:20px;font-weight:bold;',
    currentBadge: 'background:#4a90d9;color:#fff;padding:4px 14px;border-radius:20px;font-size:13px;margin-left:12px;',
    btn: 'padding:7px 16px;background:#3a3a5c;border:1px solid #555;border-radius:5px;color:#fff;cursor:pointer;font-size:13px;transition:background .2s;',
    btnDanger: 'padding:7px 16px;background:#e74c3c;border:1px solid #c0392b;border-radius:5px;color:#fff;cursor:pointer;font-size:13px;',
    info: 'padding:8px 22px;color:#999;font-size:12px;border-bottom:1px solid #333;display:flex;align-items:center;gap:8px;',
    grid: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px;padding:18px 22px;overflow-y:auto;flex:1;',
    card: 'aspect-ratio:1;background:#2a2a4c;border-radius:10px;overflow:hidden;cursor:pointer;position:relative;border:2.5px solid transparent;transition:transform .2s,box-shadow .2s,border-color .2s;',
    cardCurrent: 'border-color:#4a90d9;box-shadow:0 0 20px rgba(74,144,217,0.55);transform:scale(1.06);z-index:2;',
    img: 'width:100%;height:100%;object-fit:cover;display:block;',
    nameBar: 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.75);padding:7px 10px;font-size:12px;color:#fff;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
    delBtn: 'position:absolute;top:6px;right:6px;width:28px;height:28px;background:#e74c3c;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1;',
    hoverPreview: 'position:absolute;top:6px;right:6px;width:100px;height:100px;border:2.5px solid #4a90d9;border-radius:6px;object-fit:cover;z-index:15;display:none;box-shadow:0 4px 15px rgba(0,0,0,0.5);',
    empty: 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#666;cursor:pointer;',
    plus: 'font-size:40px;font-weight:bold;color:#555;',
    hint: 'font-size:12px;',
    broken: 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:28px;'
};

app.registerExtension({
    name: "PresetSwitcher.PresetGallery",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (!isPresetGallery(nodeData.name)) return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = async function() {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);

            this.targetNode = null;
            this.targetNodeType = null;
            this.presets = [];
            this.images = {};
            this.currentPresetIndex = 0;
            this.isManageMode = false;
            this.overlayEl = null;
            this.gridArea = null;

            // ---- 精简节点：只留目标节点下拉框 + 打开画廊按钮 ----
            this.targetNodeWidget = this.addWidget("combo", t('targetNode'), "", (v) => this.onTargetNodeChange(v), {
                values: () => {
                    const opts = [""];
                    for (const n of app.graph._nodes) {
                        if (isPresetSwitcherNode(n.type)) {
                            opts.push(`${n.title || n.type} #${n.id}`);
                        }
                    }
                    return opts;
                }
            });

            this.addWidget("button", t('openGallery'), null, () => this.showModal());

            await this.loadImages();
        };

        // ---- 目标节点选择 ----
        nodeType.prototype.onTargetNodeChange = async function(value) {
            if (!value) {
                this.targetNode = null; this.targetNodeType = null;
                this.presets = []; this.currentPresetIndex = 0;
                return;
            }
            const m = value.match(/#(\d+)$/);
            if (!m) return;
            const node = app.graph.getNodeById(parseInt(m[1]));
            if (node) {
                this.targetNode = node;
                this.targetNodeType = isPresetSwitcherStyle(node.type) ? "效率" : "lora";
                await this.loadPresets();
                this.currentPresetIndex = 0;
                if (this.gridArea) this.renderGrid();
            }
        };

        // ---- 数据加载 ----
        nodeType.prototype.loadPresets = async function() {
            try {
                const resp = await fetch('/preset-switcher/presets');
                const data = await resp.json();
                const prefix = this.targetNodeType === "效率" ? "[效率]" : "[lora]";
                this.presets = (data.presets || []).filter(p =>
                    p.filename && p.filename.startsWith(prefix) && p.name
                );
            } catch (e) { console.error('loadPresets:', e); this.presets = []; }
        };

        nodeType.prototype.loadImages = async function() {
            try {
                const resp = await fetch('/preset-switcher/images/list');
                const data = await resp.json();
                console.log('🖼�?加载图片列表:', data);
                if (data.success) {
                    this.images = {};
                    for (const img of data.images) this.images[img.filename] = img.url;
                }
            } catch (e) { console.error('loadImages:', e); this.images = {}; }
        };

        nodeType.prototype.getImageFilename = function(presetName) {
            const safeNode = this.targetNodeType || "unknown";
            const safePreset = presetName.replace(/[<>:"/\\|?*]/g, "");
            for (const ext of [".jpg", ".jpeg", ".png", ".gif", ".webp"]) {
                const fn = `${safeNode}_${safePreset}${ext}`;
                if (this.images[fn]) return fn;
            }
            return null;
        };

        // ==================== MODAL ====================
        nodeType.prototype.showModal = async function() {
            if (!this.targetNode) {
                alert(t('noTargetNode'));
                return;
            }
            await this.loadPresets();
            await this.loadImages();

            if (this.overlayEl) document.body.removeChild(this.overlayEl);

            const self = this;
            self.isManageMode = false;

            const overlay = document.createElement('div');
            overlay.setAttribute('style', C.overlay);
            self.overlayEl = overlay;

            const modal = document.createElement('div');
            modal.setAttribute('style', C.modal);

            // ===== HEADER =====
            const header = document.createElement('div');
            header.setAttribute('style', C.header);

            const titleArea = document.createElement('div');
            titleArea.style.cssText = 'display:flex;align-items:center;';

            const title = document.createElement('span');
            title.setAttribute('style', C.title);
            title.textContent = '🎨 ' + t('presetGallery');
            titleArea.appendChild(title);

            // 当前预设名称
            self.currentBadgeEl = document.createElement('span');
            self.currentBadgeEl.setAttribute('style', C.currentBadge);
            titleArea.appendChild(self.currentBadgeEl);

            header.appendChild(titleArea);

            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = 'display:flex;gap:8px;';

            const manageBtn = document.createElement('button');
            manageBtn.setAttribute('style', C.btn);
            manageBtn.textContent = '🛠 ' + t('manageMode');
            manageBtn.addEventListener('click', () => {
                self.isManageMode = !self.isManageMode;
                manageBtn.textContent = self.isManageMode ? ('�?' + t('exitManage')) : ('🛠 ' + t('manageMode'));
                manageBtn.setAttribute('style', self.isManageMode ? C.btnDanger : C.btn);
                self.renderGrid();
            });

            const uploadBtn = document.createElement('button');
            uploadBtn.setAttribute('style', C.btn);
            uploadBtn.textContent = '📷 ' + t('uploadCurrent');
            uploadBtn.addEventListener('click', () => self.uploadCurrentPresetImage());

            const closeBtn = document.createElement('button');
            closeBtn.setAttribute('style', C.btn);
            closeBtn.textContent = '�?;
            closeBtn.style.cssText += 'font-size:18px;padding:7px 12px;';
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                self.overlayEl = null;
            });

            btnGroup.appendChild(manageBtn);
            btnGroup.appendChild(uploadBtn);
            btnGroup.appendChild(closeBtn);
            header.appendChild(btnGroup);
            modal.appendChild(header);

            // ===== INFO BAR =====
            const info = document.createElement('div');
            info.setAttribute('style', C.info);
            info.textContent = `${t('connectedNode')}: ${self.targetNode.title || self.targetNode.type}  |  ${t('totalPresets')}: ${self.presets.length}`;
            modal.appendChild(info);

            // ===== GRID =====
            self.gridArea = document.createElement('div');
            self.gridArea.setAttribute('style', C.grid);
            modal.appendChild(self.gridArea);

            overlay.appendChild(modal);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    self.overlayEl = null;
                }
            });

            document.body.appendChild(overlay);
            self.renderGrid();
        };

        nodeType.prototype.renderGrid = function() {
            if (!this.gridArea) return;
            this.gridArea.innerHTML = '';

            // 更新当前预设名称
            if (this.currentBadgeEl && this.presets[this.currentPresetIndex]) {
                this.currentBadgeEl.textContent = `${t('currentPreset')}: ${this.presets[this.currentPresetIndex].name}`;
            } else if (this.currentBadgeEl) {
                this.currentBadgeEl.textContent = t('noPresetSelected');
            }

            if (this.presets.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'color:#777;text-align:center;padding:80px 20px;font-size:15px;grid-column:1/-1;';
                empty.innerHTML = `${t('noPreset')}<br><span style="font-size:12px;color:#555;">${t('createPresetHint')}</span>`;
                this.gridArea.appendChild(empty);
                return;
            }

            for (let i = 0; i < this.presets.length; i++) {
                this.gridArea.appendChild(this.createCard(this.presets[i], i));
            }
        };

        nodeType.prototype.createCard = function(preset, index) {
            const self = this;
            const card = document.createElement('div');
            card.setAttribute('style', C.card);
            const isCurrent = index === this.currentPresetIndex;

            if (isCurrent) card.style.cssText += C.cardCurrent;

            card.addEventListener('mouseenter', () => {
                if (!isCurrent) {
                    card.style.borderColor = '#4a90d9';
                    card.style.transform = 'translateY(-5px)';
                    card.style.boxShadow = '0 8px 24px rgba(74,144,217,0.35)';
                }
            });
            card.addEventListener('mouseleave', () => {
                if (!isCurrent) {
                    card.style.borderColor = 'transparent';
                    card.style.transform = '';
                    card.style.boxShadow = '';
                }
            });
            card.addEventListener('click', (e) => {
                if (e.target.dataset?.action === 'delete') return;
                if (self.isManageMode) return;
                self.currentPresetIndex = index;
                self.selectPreset(preset.name);
                self.renderGrid();
            });

            const imgFilename = this.getImageFilename(preset.name);

            if (imgFilename) {
                const encodedFname = encodeURIComponent(imgFilename);
                const img = document.createElement('img');
                img.src = `/preset-switcher/images/${encodedFname}`;
                img.setAttribute('style', C.img);
                img.draggable = false;
                img.addEventListener('load', () => console.log('图片加载成功:', imgFilename));
                img.addEventListener('error', () => {
                    console.error('图片加载失败:', imgFilename);
                    img.remove();
                    const b = document.createElement('div');
                    b.setAttribute('style', C.broken);
                    b.textContent = '�?;
                    card.prepend(b);
                });
                card.appendChild(img);

                if (this.isManageMode) {
                    const del = document.createElement('div');
                    del.setAttribute('style', C.delBtn);
                    del.textContent = '×';
                    del.dataset.action = 'delete';
                    del.addEventListener('click', (e) => {
                        e.stopPropagation();
                        self.deleteImage(preset.name, imgFilename);
                    });
                    card.appendChild(del);
                }

                const bar = document.createElement('div');
                bar.setAttribute('style', C.nameBar);
                bar.textContent = preset.name;
                card.appendChild(bar);
            } else {
                const placeholder = document.createElement('div');
                placeholder.setAttribute('style', C.empty);

                const plus = document.createElement('div');
                plus.setAttribute('style', C.plus);
                plus.textContent = '+';

                const hint = document.createElement('div');
                hint.setAttribute('style', C.hint);
                hint.textContent = t('clickOrDrag');

                placeholder.appendChild(plus);
                placeholder.appendChild(hint);
                card.appendChild(placeholder);

                placeholder.addEventListener('click', (e) => {
                    e.stopPropagation();
                    self.currentPresetIndex = index;
                    self.triggerUpload(preset.name);
                });
                placeholder.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    placeholder.style.background = 'rgba(74,144,217,0.15)';
                });
                placeholder.addEventListener('dragleave', () => {
                    placeholder.style.background = '';
                });
                placeholder.addEventListener('drop', (e) => {
                    e.preventDefault();
                    placeholder.style.background = '';
                    const file = e.dataTransfer.files[0];
                    if (file) {
                        self.currentPresetIndex = index;
                        self.uploadImage(preset.name, file);
                    }
                });

                const bar = document.createElement('div');
                bar.setAttribute('style', C.nameBar);
                bar.textContent = preset.name;
                card.appendChild(bar);
            }

            return card;
        };

        // ==================== UPLOAD / DELETE ====================
        nodeType.prototype.triggerUpload = function(presetName) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.uploadImage(presetName, file);
            });
            input.click();
        };

        nodeType.prototype.uploadCurrentPresetImage = function() {
            if (this.presets.length === 0 || !this.targetNode) {
                alert(t('noPresetSelected'));
                return;
            }
            const preset = this.presets[this.currentPresetIndex];
            if (!preset) { alert(t('noPresetSelected')); return; }
            this.triggerUpload(preset.name);
        };

        nodeType.prototype.uploadImage = async function(presetName, file) {
            try {
                console.log('📤 开始上�?', presetName, file.name, file.size);
                const fd = new FormData();
                fd.append('image', file);
                fd.append('presetName', presetName);
                fd.append('nodeType', this.targetNodeType);

                const resp = await fetch('/preset-switcher/images/upload', { method: 'POST', body: fd });
                const data = await resp.json();
                console.log('📤 上传响应:', data);

                if (data.success) {
                    await this.loadImages();
                    this.renderGrid();
                    console.log('�?图片上传成功:', data.filename);
                } else {
                    alert(t('imageUploadFailed') + ': ' + (data.error || 'Unknown error'));
                }
            } catch (e) {
                console.error('upload error:', e);
                alert(t('imageUploadFailed') + ': ' + e.message);
            }
        };

        nodeType.prototype.deleteImage = async function(presetName, filename) {
            if (!confirm(`${t('confirmDelete')} "${presetName}" ?`)) return;
            try {
                const resp = await fetch(`/preset-switcher/images/${encodeURIComponent(filename)}`, { method: 'DELETE' });
                const data = await resp.json();
                if (data.success) {
                    delete this.images[filename];
                    this.renderGrid();
                } else {
                    alert(t('imageDeleteFailed') + ': ' + (data.error || 'Unknown error'));
                }
            } catch (e) {
                console.error('delete error:', e);
                alert(t('imageDeleteFailed') + ': ' + e.message);
            }
        };

        // ==================== SELECT PRESET ====================
        nodeType.prototype.selectPreset = function(presetName) {
            if (!this.targetNode) return;
            this.targetNode.currentPresetName = presetName;
            if (this.targetNode.applyPreset) this.targetNode.applyPreset(presetName);
            if (this.targetNode.presetSelectWidget) this.targetNode.presetSelectWidget.value = presetName;
            console.log(`�?已切换到预设: ${presetName}`);
        };

        // ==================== WIRE HANDLING ====================
        const origOnConnectInput = nodeType.prototype.onConnectInput;
        nodeType.prototype.onConnectInput = function(index, type, link, node) {
            if (origOnConnectInput) origOnConnectInput.apply(this, arguments);
            if (index === 0 && this.targetNodeWidget) {
                this.targetNodeWidget.disabled = true;
                this.targetNodeWidget.value = `${node.title || node.type} #${node.id}`;
            }
            this.targetNode = node;
            this.targetNodeType = isPresetSwitcherStyle(node.type) ? "效率" : "lora";
            this.loadPresets().then(() => {
                this.currentPresetIndex = 0;
                if (this.gridArea) this.renderGrid();
            });
        };

        const origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function(type, index, connected, link_info) {
            if (origOnConnectionsChange) origOnConnectionsChange.apply(this, arguments);
            if (type === 1 && index === 0) {
                const input = this.inputs && this.inputs[0];
                if (input && !input.link) {
                    if (this.targetNodeWidget) this.targetNodeWidget.disabled = false;
                    this.targetNode = null;
                    this.targetNodeType = null;
                    this.presets = [];
                    this.currentPresetIndex = 0;
                    if (this.gridArea) this.renderGrid();
                }
            }
        };

        // ==================== STATE ====================
        nodeType.prototype.onSerialize = function(o) {
            o.preset_switcher_gallery = {
                targetNodeId: this.targetNode ? this.targetNode.id : null,
                targetNodeType: this.targetNodeType,
                currentPresetIndex: this.currentPresetIndex
            };
        };

        nodeType.prototype.onConfigure = function(o) {
            if (o.preset_switcher_gallery) {
                const d = o.preset_switcher_gallery;
                if (d.targetNodeId) {
                    setTimeout(async () => {
                        const node = app.graph.getNodeById(d.targetNodeId);
                        if (node) {
                            this.targetNode = node;
                            this.targetNodeType = d.targetNodeType;
                            if (this.targetNodeWidget) {
                                const input = this.inputs && this.inputs[0];
                                if (input && input.link) this.targetNodeWidget.disabled = true;
                                this.targetNodeWidget.value = `${node.title || node.type} #${node.id}`;
                            }
                            await this.loadPresets();
                            await this.loadImages();
                            this.currentPresetIndex = d.currentPresetIndex || 0;
                        }
                    }, 500);
                }
            }
        };
    }
});