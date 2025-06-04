// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsContent = document.getElementById('settings-content');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    const batchSizeSelect = document.getElementById('batch-size');
    const sourceContent = document.getElementById('source-content');
    const targetContent = document.getElementById('target-content');
    const translateBtn = document.getElementById('translate-btn');
    const stopBtn = document.getElementById('stop-btn');
    const retryBtn = document.getElementById('retry-btn');
    const copyTargetBtn = document.getElementById('copy-target-btn');
    const pasteSourceBtn = document.getElementById('paste-source-btn');
    const loading = document.getElementById('loading');
    const progressBar = document.getElementById('progress-bar');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const statusMessage = document.getElementById('status-message');
    const errorMessage = document.getElementById('error-message');
    const storyTitle = document.getElementById('story-title'); // If needed
    const tabs = document.querySelectorAll('.tab');
    const realtimeHint = document.getElementById('realtime-hint');
    const confirmDialog = document.getElementById('confirm-dialog');
    const confirmOverlay = document.getElementById('confirm-overlay');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const properNounIndexContainer = document.getElementById('proper-noun-index-container');
    const properNounIndexContent = document.getElementById('proper-noun-index-content');
    console.log('Proper Noun Index Content Element:', properNounIndexContent);
    const clearIndexBtn = document.getElementById('clear-index-btn');
    const emptyPrompt = sourceContent.querySelector('.empty-prompt');
    console.log('Clear Index Button Element:', clearIndexBtn);
    

    // --- State Variables ---
    let isTranslating = false;
    let shouldStop = false;
    let permanentHighlightIndex = -1;
    let currentSourceSentences = [];
    let currentTargetSentences = [];
    let activeActionButtons = null;
    let activeEditElement = null;
    let currentEditingIndex = -1;
    let currentConfirmOkCallback = null;
    let currentConfirmCancelCallback = null;
    let hintTimeout = null;
    let isCurrentTextPoetry = false; // Flag for poetry detection
    const PROPER_NOUN_INDEX_KEY = 'properNounIndex';

    // --- Initialization ---

    // Load saved API Key
    const savedApiKey = localStorage.getItem('deepseek_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // Load and render initial proper noun index
    renderProperNounIndex();

    // --- Event Listeners ---

    // API Settings Toggle
    settingsToggle.addEventListener('click', function() {
        settingsContent.classList.toggle('show');
        this.textContent = settingsContent.classList.contains('show') ? '隐藏 ▲' : '显示 ▼';
    });

    // Tabs (if more tabs are implemented)
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Add logic here if tabs control different views
        });
    });

    // ++ 新增: 清空索引按钮事件监听
clearIndexBtn.addEventListener('click', () => {
    console.log('Clear Index button clicked.'); // ++ 添加: 确认按钮点击事件触发
    showConfirmDialog(
        '确定要清空所有专有名词索引吗？此操作不可撤销。',
        () => { // OK Callback (确认清空)
            console.log('Clear confirmation received (OK clicked).'); // ++ 添加: 确认OK回调执行
            try {
                localStorage.removeItem(PROPER_NOUN_INDEX_KEY);
                console.log(`localStorage item removed for key: ${PROPER_NOUN_INDEX_KEY}.`); // ++ 修改: 更明确的日志

                // ++ 添加: 确认 localStorage 是否真的空了
                const checkIndexAfterRemove = localStorage.getItem(PROPER_NOUN_INDEX_KEY);
                console.log(`Checking index in localStorage immediately after remove: ${checkIndexAfterRemove === null ? 'Successfully removed (null)' : 'Still exists!'}`);

                console.log('Calling renderProperNounIndex() to update UI...'); // ++ 添加: 确认调用渲染函数
                renderProperNounIndex(); // 重新渲染索引区域
                console.log('renderProperNounIndex() called.'); // ++ 添加: 确认调用完成

                showRealtimeHint("专有名词索引已清空");
            } catch (error) {
                console.error("Error during clear index process:", error); // ++ 修改: 统一错误日志格式
                showError("清空索引时出错。");
            }
        },
        () => { // Cancel Callback (取消清空)
            console.log("Clear index operation cancelled.");
        }
    );
});


    // Paste Source Text Button
    pasteSourceBtn.addEventListener('click', handlePasteSource);

    // Source Content Area Paste Event
    sourceContent.addEventListener('paste', handleDirectPaste);

    // Source Content Focus/Blur for Placeholder
    sourceContent.addEventListener('focus', () => {
        if (emptyPrompt) emptyPrompt.style.display = 'none';
    });
    sourceContent.addEventListener('blur', () => {
        if (sourceContent.textContent.trim() === '' && emptyPrompt) {
            emptyPrompt.style.display = 'block';
        }
    });
     sourceContent.addEventListener('input', () => {
        if (sourceContent.textContent.trim() === '' && emptyPrompt) {
             emptyPrompt.style.display = 'block';
        } else if (emptyPrompt) {
             emptyPrompt.style.display = 'none';
        }
     });


    // Translate Button
    translateBtn.addEventListener('click', handleTranslate);

    // Stop Button
    stopBtn.addEventListener('click', () => {
        shouldStop = true;
        stopBtn.disabled = true;
        stopBtn.textContent = '正在停止...';
        showRealtimeHint('正在请求停止翻译...');
    });

    // Retry Button
    retryBtn.addEventListener('click', retryMissingTranslations);

    // Copy Target Text Button
    copyTargetBtn.addEventListener('click', handleCopyTarget);

    // Confirm Dialog Buttons
    confirmOkBtn.addEventListener('click', () => {
        console.log("Dialog 'OK' button clicked."); // ++ 日志: 确认OK按钮被点击
        hideConfirmDialog(); // 关闭对话框
        if (typeof currentConfirmOkCallback === 'function') {
            console.log("Executing OK callback..."); // ++ 日志: 确认执行OK回调
            currentConfirmOkCallback(); // !! 执行存储的 OK 回调函数 !!
        } else {
            console.warn("No OK callback function found to execute."); // ++ 日志: 警告没有找到回调
        }
        // 清理回调引用，防止意外重用
        currentConfirmOkCallback = null;
        currentConfirmCancelCallback = null;
    });

    confirmCancelBtn.addEventListener('click', () => {
        console.log("Dialog 'Cancel' button clicked."); // ++ 日志: 确认Cancel按钮被点击
        hideConfirmDialog(); // 关闭对话框
        if (typeof currentConfirmCancelCallback === 'function') {
            console.log("Executing Cancel callback..."); // ++ 日志: 确认执行Cancel回调
            currentConfirmCancelCallback(); // !! 执行存储的 Cancel 回调函数 !!
        } else {
            console.warn("No Cancel callback function found to execute."); // ++ 日志: 警告没有找到回调
        }
        // 清理回调引用
        currentConfirmOkCallback = null;
        currentConfirmCancelCallback = null;
    });

    confirmOverlay.addEventListener('click', () => {
        console.log("Dialog overlay clicked (treated as Cancel)."); // ++ 日志: 确认遮罩层被点击
        hideConfirmDialog(); // 关闭对话框
        if (typeof currentConfirmCancelCallback === 'function') {
             console.log("Executing Cancel callback via overlay..."); // ++ 日志: 确认执行Cancel回调
             currentConfirmCancelCallback(); // !! 执行存储的 Cancel 回调函数 !!
        } else {
             console.warn("No Cancel callback function found to execute via overlay."); // ++ 日志: 警告没有找到回调
        }
        // 清理回调引用
        currentConfirmOkCallback = null;
        currentConfirmCancelCallback = null;
    });


    // Global Click Listener (for closing popups/menus)
    document.addEventListener('click', (event) => {
        // Close sentence actions if click is outside
        if (activeActionButtons && !event.target.closest('.sentence-number')) {
             hideAllActionButtons();
        }

        // Handle clicks outside edit mode (consider confirmation) - Simplified for now
        // Add more robust handling if needed, similar to original code's logic
        // if (activeEditElement && !event.target.closest('.edit-mode') && !event.target.closest('.confirm-dialog')) {
        //     // Maybe prompt to save/cancel if clicking outside
        //     console.log("Clicked outside edit mode - potential cancel/save action needed");
        // }
    });

     // ESC key listener
     document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (confirmDialog.style.display === 'block') {
                hideConfirmDialog();
                 if (typeof currentConfirmCancelCallback === 'function') {
                     currentConfirmCancelCallback();
                 }
            } else if (activeEditElement) {
                cancelEditMode(); // Cancel sentence edit on ESC
            } else if (activeActionButtons) {
                hideAllActionButtons(); // Close action buttons on ESC
            }
        }
     });

    // --- Core Functions ---

    // Handle Pasting into Source Area (Button)
    async function handlePasteSource() {
        if (isTranslating) return; // Don't allow paste during translation
        try {
            const text = await navigator.clipboard.readText();
            processPastedText(text);
            showRealtimeHint('文本已粘贴');
        } catch (error) {
            console.error('粘贴操作失败:', error);
            showError('无法访问剪贴板。请手动粘贴或检查权限。');
        }
    }

    // Handle Direct Pasting into Source Area (Event)
    function handleDirectPaste(e) {
        if (isTranslating) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        processPastedText(text);
        showRealtimeHint('文本已粘贴');
    }

    // Process and Render Pasted Text
    function processPastedText(text) {
        // Insert text as plain text
        sourceContent.textContent = text; // Replace entire content
        if (emptyPrompt) emptyPrompt.style.display = 'none'; // Hide prompt

        // Reset previous state
        currentTargetSentences = [];
        targetContent.textContent = '翻译将显示在这里...';
        removeHighlightAndEvents();
        permanentHighlightIndex = -1;

        // Analyze and render source sentences
        try {
            currentSourceSentences = splitSentencesWithNLP(text);
            renderSentences(sourceContent, currentSourceSentences, true);
        } catch (error) {
            console.error("Error splitting/rendering source text:", error);
            showError(`处理源文本时出错: ${error.message}`);
            sourceContent.textContent = text; // Fallback to plain text
        }
    }

    // Handle Translation Request
    async function handleTranslate() {
        const text = sourceContent.textContent.trim();
        if (!text) {
            showError('源文本为空');
            return;
        }

        const key = apiKeyInput.value.trim();
        if (!key) {
            showError('请输入DeepSeek API Key');
            return;
        }

        const model = modelSelect.value;

        // Disable source editing and paste button
        sourceContent.contentEditable = false;
        sourceContent.style.backgroundColor = ''; // Reset background if needed
        sourceContent.style.border = ''; // Reset border if needed
        pasteSourceBtn.disabled = true;
        pasteSourceBtn.style.opacity = '0.5';

        showLoading(true);
        clearError();
        isTranslating = true;
        shouldStop = false; // Reset stop flag
        stopBtn.disabled = false; // Enable stop button
        stopBtn.textContent = '停止翻译';
        retryBtn.style.display = 'none'; // Hide retry button initially

        try {
            // Ensure source sentences are processed if not already
            if (currentSourceSentences.length === 0 || sourceContent.querySelectorAll('.sentence').length === 0) {
                 console.log("Processing source text before translation...");
                 currentSourceSentences = splitSentencesWithNLP(text);
                 renderSentences(sourceContent, currentSourceSentences, true);
            }
            if (currentSourceSentences.length === 0) {
                throw new Error("未能成功分割源文本句子。");
            }

            console.log(`开始翻译 ${currentSourceSentences.length} 个句子...`);
            await translateWithDeepSeek(currentSourceSentences, key, model);

            // Check for missing translations after completion
            const missingCount = currentTargetSentences.filter(s => s.isMissing).length;
            if (missingCount > 0 && !shouldStop) {
                showError(`翻译完成，但有 ${missingCount} 个句子缺失或出错。`);
                retryBtn.style.display = 'inline-block'; // Show retry button
            } else if (!shouldStop) {
                showRealtimeHint('翻译完成！');
            } else {
                 showRealtimeHint('翻译已停止。');
                 if (missingCount > 0) {
                    retryBtn.style.display = 'inline-block';
                 }
            }
            // Render the index after translation might have updated it
            renderProperNounIndex();

        } catch (error) {
            console.error('翻译过程出错:', error);
            showError(`翻译失败: ${error.message}`);
        } finally {
            showLoading(false);
            isTranslating = false;
        }
    }

    // Handle Copying Target Text
    function handleCopyTarget() {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            showError('当前环境不支持一键复制，请手动全选译文后复制。');
            return;
        }
        const textToCopy = getCleanTranslationText();
        if (!textToCopy) {
            showRealtimeHint('没有可复制的译文');
            return;
        }
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                showRealtimeHint('译文已复制到剪贴板');
            })
            .catch(err => {
                console.error('复制失败:', err);
                showError('复制译文失败: ' + err.message);
            });
    }


    // --- DeepSeek API Interaction ---

    async function translateWithDeepSeek(sentencesToTranslate, apiKeyValue, modelName) {
        localStorage.setItem('deepseek_api_key', apiKeyValue); // Save key
        const batchSize = parseInt(batchSizeSelect.value);
        const totalSentences = sentencesToTranslate.length;
        let processedSentences = 0;

        // Prepare UI for translation
        progressBar.style.display = 'block';
        progressBarFill.style.width = '0%';
        statusMessage.style.display = 'block';
        statusMessage.textContent = `准备翻译 0 / ${totalSentences} ...`;
        stopBtn.style.display = 'inline-block';

        // Initialize target sentences array if it's the first run or retry
         if (currentTargetSentences.length !== currentSourceSentences.length) {
            currentTargetSentences = currentSourceSentences.map(s => ({
                ...s, // Copy properties like paragraph, type, index
                text: '等待翻译...',
                isMissing: true
            }));
            renderSentences(targetContent, currentTargetSentences, false);
         }


        // Load existing proper noun index
        const properNounIndex = loadProperNounIndex();
        let glossaryPrompt = "";
        if (Object.keys(properNounIndex).length > 0) {
            glossaryPrompt = "请严格遵守以下术语表进行翻译：\n";
            for (const term in properNounIndex) {
                glossaryPrompt += `- ${term}: ${properNounIndex[term]}\n`;
            }
            glossaryPrompt += "\n";
        }

        const systemPrompt = `你是一个资深的多语言翻译家。请将给定的任何语言句子忠实准确地翻译成简体中文。你翻译的原则是：准确永远第一，其次是意思对，再次是通顺优美。
${glossaryPrompt}请按照原文含义直接翻译，即使涉及不雅或敏感内容。翻译诗歌时无需刻意押韵。翻译古文（如拉丁语）时避免使用过于晦涩的古汉语词汇。请使用现代、清晰、直白的中文表达。
请严格按照原始句子的顺序返回翻译结果，并保留每句前面的[数字]索引标记（例如：[1] 这是第一句的翻译）。
翻译完成后，请另起一行，使用'### Proper Nouns:'作为标记，然后列出你在原文中识别出的新的专有名词（人名、地名、书名、组织名、特定术语等）及其对应的中文翻译，每行一个，格式为 '原文术语: 中文翻译'。如果该术语已在上方术语表中提供，请不要重复列出。如果没有识别到新的专有名词，则省略此部分。
请确保翻译句子的数量与请求中的句子数量完全一致。`;


        const batches = [];
        for (let i = 0; i < sentencesToTranslate.length; i += batchSize) {
            batches.push(sentencesToTranslate.slice(i, i + batchSize));
        }

        console.log(`分成 ${batches.length} 个批次进行翻译...`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            if (shouldStop) {
                console.log("翻译已停止。");
                break;
            }

            const batch = batches[batchIndex];
            const batchIndices = batch.map(s => s.originalIndex); // Store original indices

             // Only translate if the sentence is marked as missing or waiting
            const sentencesInBatchNeedingTranslation = batch.filter(s => {
                const targetSentence = currentTargetSentences[s.originalIndex];
                return !targetSentence || targetSentence.isMissing || targetSentence.text === '等待翻译...' || targetSentence.text === '正在翻译...';
            });

             if (sentencesInBatchNeedingTranslation.length === 0) {
                 console.log(`批次 ${batchIndex + 1} 无需翻译，跳过。`);
                 processedSentences += batch.length; // Still count as processed for progress
                 const progress = Math.min(100, Math.round((processedSentences / totalSentences) * 100));
                 progressBarFill.style.width = `${progress}%`;
                 statusMessage.textContent = `已处理 ${processedSentences} / ${totalSentences} 个句子 (${progress}%)`;
                 continue; // Skip this batch
             }


            // Mark sentences in this batch as 'translating' in the UI
            batchIndices.forEach(index => {
                 if (currentTargetSentences[index] && currentTargetSentences[index].isMissing) {
                    currentTargetSentences[index].text = '正在翻译...';
                 }
            });
             try { // Update UI immediately
                renderSentences(targetContent, currentTargetSentences, false);
             } catch (renderError) { console.error("UI update error:", renderError); }


            console.log(`翻译批次 ${batchIndex + 1} / ${batches.length} (句子 ${batchIndices[0] + 1} - ${batchIndices[batchIndices.length - 1] + 1})...`);

            const translationPrompt = sentencesInBatchNeedingTranslation.map((s, i) =>
                 // Use a unique ID based on originalIndex for better robustness? Or just 1-based index within batch.
                `[${i + 1}] ${s.text}`
            ).join('\n\n');


            try {
                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKeyValue}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: `请将以下 ${sentencesInBatchNeedingTranslation.length} 个句子翻译成中文，保留索引标记：\n\n${translationPrompt}` }
                        ],
                        temperature: 0.3
                    })
                });

                if (!response.ok) {
                    let errorBody = null;
                    try { errorBody = await response.json(); } catch (e) { /* Ignore parsing error */ }
                     const errorMessageText = errorBody?.error?.message || `HTTP ${response.status} ${response.statusText}`;
                     console.error("API Error Response:", errorBody);
                    throw new Error(`DeepSeek API 错误: ${errorMessageText}`);
                }

                const data = await response.json();
                if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
                    throw new Error('DeepSeek API 返回无效响应格式');
                }

                const rawContent = data.choices[0].message.content;

                // Separate translation from proper nouns
                let translationPart = rawContent;
                let properNounPart = "";
                const pnSeparator = '### Proper Nouns:';
                const separatorIndex = rawContent.indexOf(pnSeparator);

                if (separatorIndex !== -1) {
                    translationPart = rawContent.substring(0, separatorIndex).trim();
                    properNounPart = rawContent.substring(separatorIndex + pnSeparator.length).trim();
                }

                // Parse translations
                const translationLines = translationPart.split('\n').filter(line => line.trim().length > 0);
                const indexedTranslations = {};
                let incorrectFormatCount = 0;

                translationLines.forEach(line => {
                    const match = line.match(/^\[(\d+)\]\s*(.*)/);
                    if (match) {
                        const indexInBatch = parseInt(match[1]) - 1; // 0-based index *within the batch*
                        if (indexInBatch >= 0 && indexInBatch < sentencesInBatchNeedingTranslation.length) {
                            const originalSentenceIndex = sentencesInBatchNeedingTranslation[indexInBatch].originalIndex;
                            indexedTranslations[originalSentenceIndex] = match[2].trim();
                        } else {
                            console.warn(`解析翻译时索引超出批次范围: ${line}`);
                            incorrectFormatCount++;
                        }
                    } else {
                        console.warn(`翻译结果格式不正确 (缺少索引): ${line}`);
                        incorrectFormatCount++;
                        // Attempt to salvage if only one line and no index? Risky.
                    }
                });

                 // Check if the number of parsed translations matches the number requested
                 const parsedCount = Object.keys(indexedTranslations).length;
                 const expectedCount = sentencesInBatchNeedingTranslation.length;
                 if (parsedCount !== expectedCount) {
                     console.warn(`翻译批次 ${batchIndex + 1} 结果数量不匹配: 期望 ${expectedCount}，实际解析到 ${parsedCount} (格式错误: ${incorrectFormatCount})`);
                 }


                // Update target sentences based on parsed translations
                 sentencesInBatchNeedingTranslation.forEach(sourceSentence => {
                    const originalIndex = sourceSentence.originalIndex;
                    if (indexedTranslations.hasOwnProperty(originalIndex)) {
                         currentTargetSentences[originalIndex].text = indexedTranslations[originalIndex];
                         currentTargetSentences[originalIndex].isMissing = false;
                    } else {
                         // Only mark as missing if it wasn't already successfully translated
                         if (currentTargetSentences[originalIndex].isMissing || currentTargetSentences[originalIndex].text === '正在翻译...') {
                            console.warn(`句子 ${originalIndex + 1} 在批次 ${batchIndex + 1} 中未收到有效翻译。`);
                            currentTargetSentences[originalIndex].text = `[翻译缺失]`;
                            currentTargetSentences[originalIndex].isMissing = true;
                         }
                    }
                 });


                // Parse and update proper noun index
                if (properNounPart) {
                    parseAndUpdateProperNounIndex(properNounPart);
                    // No need to re-render index here, do it once at the end
                }

                // Short delay
                await new Promise(resolve => setTimeout(resolve, 300)); // Reduced delay

            } catch (error) {
                console.error(`批次 ${batchIndex + 1} 翻译失败:`, error);
                 showError(`部分翻译失败 (批次 ${batchIndex + 1}): ${error.message.substring(0,100)}...`);
                // Mark sentences in this batch as error, if not already translated
                 sentencesInBatchNeedingTranslation.forEach(sourceSentence => {
                     const originalIndex = sourceSentence.originalIndex;
                     // Only mark error if it's still waiting/translating
                     if (currentTargetSentences[originalIndex].isMissing || currentTargetSentences[originalIndex].text === '正在翻译...') {
                        currentTargetSentences[originalIndex].text = '[翻译错误]';
                        currentTargetSentences[originalIndex].isMissing = true;
                     }
                 });
                 await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay after error
            } finally {
                // Update progress regardless of success/failure for this batch
                 processedSentences += batch.length; // Count all sentences in the original batch for progress
                 const progress = Math.min(100, Math.round((processedSentences / totalSentences) * 100));
                 progressBarFill.style.width = `${progress}%`;
                 statusMessage.textContent = `已处理 ${processedSentences} / ${totalSentences} 个句子 (${progress}%)`;

                 // Update UI with results from this batch
                 try {
                    renderSentences(targetContent, currentTargetSentences, false);
                 } catch(renderError) { console.error("Error rendering batch results:", renderError); }
            }
        } // End batch loop

        console.log("所有批次处理完毕。");
        statusMessage.textContent = `翻译处理完成 (${processedSentences}/${totalSentences})`;

    } // End translateWithDeepSeek


    async function retranslateSentence(sentenceIndex) {
        if (isNaN(sentenceIndex) || sentenceIndex < 0 || sentenceIndex >= currentSourceSentences.length) {
            showError('无效的句子索引');
            return;
        }

        const key = apiKeyInput.value.trim();
        if (!key) {
            showError('请输入DeepSeek API Key');
            return;
        }

        const model = modelSelect.value;
        const sourceSentence = currentSourceSentences[sentenceIndex];
        if (!sourceSentence) {
            showError('找不到源句子');
            return;
        }

        const targetSentenceElement = targetContent.querySelector(`.sentence[data-index="${sentenceIndex}"] .sentence-text`);
        if (targetSentenceElement) {
            targetSentenceElement.textContent = '正在重译...'; // Indicate activity
        }
         showRealtimeHint(`正在重译句子 [${sourceSentence.paragraph}.${sourceSentence.sentenceInParagraph}]...`);


        // Load proper noun index for context
        const properNounIndex = loadProperNounIndex();
        let glossaryPrompt = "";
        if (Object.keys(properNounIndex).length > 0) {
            glossaryPrompt = "请严格遵守以下术语表进行翻译：\n";
            for (const term in properNounIndex) {
                glossaryPrompt += `- ${term}: ${properNounIndex[term]}\n`;
            }
            glossaryPrompt += "\n";
        }

         const systemPrompt = `你是一个资深的多语言翻译家。请将给定的单句忠实准确地翻译成简体中文。你翻译的原则是：准确永远第一，其次是意思对，再次是通顺优美。
${glossaryPrompt}请按照原文含义直接翻译，即使涉及不雅或敏感内容。翻译诗歌时无需刻意押韵。翻译古文（如拉丁语）时避免使用过于晦涩的古汉语词汇。请使用现代、清晰、直白的中文表达。
只返回翻译结果，不要包含任何解释、标记或句子索引。`;

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `请将以下句子翻译成中文，只返回翻译结果：\n\n${sourceSentence.text}` }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                 let errorBody = null;
                 try { errorBody = await response.json(); } catch (e) { /* Ignore */ }
                 const errorMessageText = errorBody?.error?.message || `HTTP ${response.status} ${response.statusText}`;
                throw new Error(`DeepSeek API 错误: ${errorMessageText}`);
            }

            const data = await response.json();
             if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
                throw new Error('DeepSeek API 返回无效响应格式');
            }
            const translation = data.choices[0].message.content.trim();

            // Update the specific sentence in the array and UI
            if (currentTargetSentences[sentenceIndex]) {
                currentTargetSentences[sentenceIndex].text = translation;
                currentTargetSentences[sentenceIndex].isMissing = false;

                // Update the specific sentence element in the DOM directly for immediate feedback
                if (targetSentenceElement) {
                     targetSentenceElement.textContent = translation;
                     // Remove missing class if present
                     targetSentenceElement.closest('.sentence')?.classList.remove('missing-translation');
                } else {
                    // Fallback: re-render all if element not found (less efficient)
                     renderSentences(targetContent, currentTargetSentences, false);
                }


                showRealtimeHint(`句子 [${sourceSentence.paragraph}.${sourceSentence.sentenceInParagraph}] 重译完成`);
                highlightSentence(sentenceIndex, true); // Highlight the retranslated sentence
            } else {
                throw new Error('找不到对应的目标句子数据');
            }

        } catch (error) {
            console.error('单句重译错误:', error);
            showError(`重译失败: ${error.message}`);
            // Revert text in UI if possible
             if (targetSentenceElement && currentTargetSentences[sentenceIndex]) {
                targetSentenceElement.textContent = currentTargetSentences[sentenceIndex].text; // Revert to previous text
             }
        }
    }

    // Retry Missing Translations
    async function retryMissingTranslations() {
        if (isTranslating) {
            showError('请等待当前翻译任务完成。');
            return;
        }
         const key = apiKeyInput.value.trim();
         if (!key) {
            showError('请输入DeepSeek API Key');
            return;
         }
        const model = modelSelect.value;


        const missingIndices = currentTargetSentences
            .map((sentence, index) => sentence.isMissing ? index : -1)
            .filter(index => index !== -1);

        if (missingIndices.length === 0) {
            showRealtimeHint('没有需要重试的翻译');
            retryBtn.style.display = 'none'; // Hide button if nothing is missing
            return;
        }

        const sentencesToRetry = missingIndices.map(index => currentSourceSentences[index]);

        showRealtimeHint(`正在重试 ${sentencesToRetry.length} 个缺失的翻译...`);
        showLoading(true); // Show loading indicator
        clearError();
        isTranslating = true; // Set flag
        shouldStop = false;
        stopBtn.disabled = false;
        stopBtn.textContent = '停止翻译';


        try {
            // Important: Pass only the sentences that need retrying
            await translateWithDeepSeek(sentencesToRetry, key, model);

             // Re-check for missing after retry
             const stillMissingCount = currentTargetSentences.filter(s => s.isMissing).length;
             if (stillMissingCount > 0 && !shouldStop) {
                showError(`重试完成，仍有 ${stillMissingCount} 个句子缺失或出错。`);
                retryBtn.style.display = 'inline-block'; // Keep button visible
             } else if (!shouldStop) {
                showRealtimeHint('重试翻译完成！');
                retryBtn.style.display = 'none'; // Hide button on success
             } else {
                 showRealtimeHint('重试翻译已停止。');
                 if (stillMissingCount > 0) {
                     retryBtn.style.display = 'inline-block';
                 } else {
                      retryBtn.style.display = 'none';
                 }
             }
             // Update index display in case terms were identified during retry
             renderProperNounIndex();

        } catch (error) {
            console.error('重试翻译失败:', error);
            showError(`重试翻译失败: ${error.message}`);
            retryBtn.style.display = 'inline-block'; // Keep retry button visible on error
        } finally {
            showLoading(false); // Hide loading indicator
            isTranslating = false; // Clear flag
        }
    }


    // --- Proper Noun Index Functions ---

    function loadProperNounIndex() {
        try {
            const storedIndex = localStorage.getItem(PROPER_NOUN_INDEX_KEY);
            return storedIndex ? JSON.parse(storedIndex) : {};
        } catch (error) {
            console.error("Error loading proper noun index:", error);
            showError("加载专有名词索引失败。");
            return {};
        }
    }

    function saveProperNounIndex(index) {
        try {
            localStorage.setItem(PROPER_NOUN_INDEX_KEY, JSON.stringify(index));
        } catch (error) {
            console.error("Error saving proper noun index:", error);
            showError("保存专有名词索引失败。");
        }
    }

    function parseAndUpdateProperNounIndex(properNounText) {
        const current_index = loadProperNounIndex();
        const lines = properNounText.split('\n');
        let updated = false;

        lines.forEach(line => {
            // Match "Original Term: Chinese Translation"
            // Be lenient with whitespace around the colon
            const match = line.match(/^(.*?)\s*:\s*(.*)$/);
            if (match) {
                const original = match[1].trim();
                const translation = match[2].trim();
                // Add only if it's a non-empty term and not already in the index
                if (original && translation && !current_index.hasOwnProperty(original)) {
                    current_index[original] = translation;
                    updated = true;
                    console.log(`Added new term to index: "${original}": "${translation}"`);
                }
            }
        });

        if (updated) {
            saveProperNounIndex(current_index);
            // Re-render the index display after updating
            // renderProperNounIndex(); // Rendered once at the end of translation now
        }
    }

    function renderProperNounIndex() {
    console.log('--- renderProperNounIndex started ---'); // ++ 添加: 确认函数开始
    const index = loadProperNounIndex(); // Loads from localStorage
    console.log('Loaded index data for rendering:', index); // ++ 添加: 显示加载到的数据

    // ++ 添加: 检查获取的容器元素是否有效
    if (!properNounIndexContent) {
        console.error('Cannot render index: properNounIndexContent element is null!');
        return; // 如果容器不存在，则无法渲染
    }

    properNounIndexContent.innerHTML = ''; // Clear previous content
    console.log('Cleared properNounIndexContent innerHTML.'); // ++ 添加: 确认清空了容器

    if (index && typeof index === 'object' && Object.keys(index).length === 0) {
        console.log('Index is empty, rendering empty message.'); // ++ 添加: 确认进入空状态逻辑
        properNounIndexContent.innerHTML = '<p>暂无专有名词记录。翻译过程中将自动识别并添加。</p>';
        console.log('Empty message rendered.'); // ++ 添加: 确认空消息已设置
        console.log('--- renderProperNounIndex finished (empty) ---'); // ++ 添加: 确认函数结束
        return; // 确保在这里返回
    } else if (!index || typeof index !== 'object') {
         console.warn('Loaded index data is invalid or null, rendering empty message.'); // 处理加载失败的情况
         properNounIndexContent.innerHTML = '<p>加载索引失败或无记录。</p>';
         console.log('--- renderProperNounIndex finished (invalid data) ---');
         return;
    }


    // --- 如果索引不为空，则构建表格 (这部分逻辑保持不变) ---
    console.log('Index is not empty, proceeding to render table.'); // ++ 添加: 确认渲染表格
    const table = document.createElement('table');
    table.id = 'proper-noun-index-table';
    // ... (创建表头 thead 的代码保持不变) ...
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headerRow.innerHTML = '<th>原文术语</th><th>中文翻译</th><th>操作</th>';


    const tbody = table.createTBody();
    const sortedTerms = Object.keys(index).sort((a, b) => a.localeCompare(b));

    sortedTerms.forEach(originalTerm => {
        // ... (创建表格行 row, 单元格 cellOriginal, cellTranslation, cellAction 的代码保持不变) ...
         const row = tbody.insertRow();

         const cellOriginal = row.insertCell();
         cellOriginal.textContent = originalTerm;

         const cellTranslation = row.insertCell();
         const translationSpan = document.createElement('span');
         translationSpan.className = 'editable-translation';
         translationSpan.textContent = index[originalTerm];
         translationSpan.contentEditable = true;
         translationSpan.dataset.originalTranslation = index[originalTerm];
         cellTranslation.appendChild(translationSpan);

         const cellAction = row.insertCell();
         const saveBtn = document.createElement('button');
         saveBtn.textContent = '保存';
         saveBtn.className = 'save-index-btn';
         saveBtn.dataset.term = originalTerm;
         saveBtn.addEventListener('click', handleIndexEditSave);
         cellAction.appendChild(saveBtn);
    });

    properNounIndexContent.appendChild(table);
    console.log('Index table rendered.'); // ++ 添加: 确认表格已添加
    console.log('--- renderProperNounIndex finished (table) ---'); // ++ 添加: 确认函数结束
}

    function handleIndexEditSave(event) {
    const button = event.target;
    const originalTerm = button.dataset.term;
    const row = button.closest('tr');
    const editableSpan = row.querySelector('.editable-translation');

    if (!originalTerm || !editableSpan) {
        showError("无法保存索引修改：元素查找失败。");
        console.error("Error in handleIndexEditSave: Cannot find originalTerm or editableSpan.");
        return;
    }

    const oldTranslation = editableSpan.dataset.originalTranslation;
    const newTranslation = editableSpan.textContent.trim();

    console.log(`[Index Save] Term: "${originalTerm}"`);
    console.log(`[Index Save] Old Translation (from dataset): "${oldTranslation}"`);
    console.log(`[Index Save] New Translation (from editable span): "${newTranslation}"`);


    if (newTranslation === oldTranslation) {
        showRealtimeHint("译文未更改。");
        editableSpan.blur();
        return;
    }

    if (!newTranslation) {
         showError("译文不能为空。");
         editableSpan.focus();
         return;
    }

    // Update index in localStorage
    const index = loadProperNounIndex();
    index[originalTerm] = newTranslation;
    saveProperNounIndex(index);
    // ++ 添加日志确认保存
    console.log(`[Index Save] Index saved to localStorage. Key: "${PROPER_NOUN_INDEX_KEY}". Value for "${originalTerm}" updated to "${newTranslation}". Checking localStorage content:`, localStorage.getItem(PROPER_NOUN_INDEX_KEY));


    // Update the data attribute *after* saving, for the *next* edit cycle
    editableSpan.dataset.originalTranslation = newTranslation;
    editableSpan.blur();

    showRealtimeHint(`术语 "${originalTerm}" 的译文已更新`);

    // --- Trigger replacement in the target text area ---
    console.log(`[Index Save] Calling replaceAllOccurrencesInTarget with Old='${oldTranslation}', New='${newTranslation}'`);
    replaceAllOccurrencesInTarget(originalTerm, oldTranslation, newTranslation);

    // Optional: add visual feedback
    if(row) {
        row.style.backgroundColor = '#E8F5E9';
        setTimeout(() => { row.style.backgroundColor = ''; }, 1500);
    }
}

    // Utility to escape regex special characters
     function escapeRegex(string) {
        // Ensure input is a string before calling replace
        if (typeof string !== 'string') {
            console.warn("escapeRegex called with non-string value:", string);
            return ''; // Return empty string or handle error appropriately
        }
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }


    function replaceAllOccurrencesInTarget(originalTerm, oldTranslation, newTranslation) {
     console.log(`--- Entered replaceAllOccurrencesInTarget ---`);
     console.log(`  Searching for (Old): "${oldTranslation}"`);
     console.log(`  Replacing with (New): "${newTranslation}"`);

     // Basic validation
     if (!oldTranslation || typeof oldTranslation !== 'string' || oldTranslation === newTranslation) {
         console.warn(`  Skipping replacement: Old translation is invalid, empty, or same as new.`);
         return;
     }
     if (typeof newTranslation !== 'string') {
        console.warn(`  Skipping replacement: New translation is not a string.`);
        return;
     }

     console.log(`  Current target sentence count: ${currentTargetSentences.length}`);
     let replacedCount = 0;

     const escapedOldTranslation = escapeRegex(oldTranslation);
     if (!escapedOldTranslation) {
        console.warn("  Skipping replacement: Escaped old translation is empty.");
        return;
     }

     let regex;
     try {
         // ** !! 主要修改点: 移除了 \b 单词边界 !! **
         regex = new RegExp(escapedOldTranslation, 'gi'); // 'g' for global, 'i' for case-insensitive
         console.log(`  Created Regex (case-insensitive, NO word boundaries): ${regex}`);
     } catch (e) {
         console.error("  Error creating RegExp:", e);
         showError(`创建查找规则时出错，无法替换术语 "${oldTranslation}"。`);
         return;
     }


     currentTargetSentences.forEach((sentence, i) => {
         if (sentence && typeof sentence.text === 'string') {
             const originalSentenceText = sentence.text;
             try {
                 // 使用不区分大小写的正则进行替换 (现在没有 \b 了)
                 const newSentenceText = originalSentenceText.replace(regex, newTranslation);
                 if (newSentenceText !== originalSentenceText) {
                     console.log(`  Replaced in sentence index ${i}: "${originalSentenceText}" \n      -> "${newSentenceText}"`);
                     currentTargetSentences[i].text = newSentenceText; // Update the data array
                     replacedCount++;
                 }
             } catch (replaceError) {
                 console.error(`  Error replacing text in sentence index ${i}:`, replaceError);
             }
         }
     });

     console.log(`  Total replacements made in data array: ${replacedCount}`);

     // Re-render the target content *only if* replacements were made
     if (replacedCount > 0) {
         console.log("  Calling renderSentences to update the target UI...");
         try {
             renderSentences(targetContent, currentTargetSentences, false); // Update the UI
             console.log("  Target content re-rendered successfully.");
             showRealtimeHint(`已将 ${replacedCount} 处 "${oldTranslation}" (不区分大小写) 更新为 "${newTranslation}"`);
         } catch (renderError) {
             console.error("  Error during renderSentences after replacement:", renderError);
             showError("术语替换后更新译文显示时出错。");
         }
     } else {
         // 修改了提示信息，因为现在没有 \b 了
         console.log(`  No occurrences of "${oldTranslation}" (case-insensitive) found for replacement.`);
     }
     console.log(`--- Exiting replaceAllOccurrencesInTarget ---`);
}


    // --- Text Processing and Rendering ---

    function splitSentencesWithNLP(text) {
        if (!text) return [];
        text = text.trim(); // Trim input text first

        // Rudimentary check for poetry - improve if needed
        isCurrentTextPoetry = isPoetryText(text); // Use the helper function

        if (isCurrentTextPoetry) {
             console.log('检测到诗歌格式 (粗略)，按行分割');
             // Simple line split for poetry, preserving empty lines
             const lines = text.split('\n');
             return lines.map((line, index) => ({
                 text: line.trim(), // Trim each line for processing, keep original structure idea
                 rawText: line, // Keep original line maybe?
                 type: line.trim() ? 'poetry_line' : 'empty_line',
                 paragraph: index + 1, // Each line is its own "paragraph"
                 sentenceInParagraph: 1,
                 originalIndex: index,
                 indentation: line.length - line.trimStart().length, // Simple indent tracking
                 lineNumber: line.trim() ? index + 1 : -1 // Assign line number only to non-empty lines
             }));
        } else {
             console.log('使用 NLP (Compromise) 进行断句');
             // Use Compromise for sentence splitting
             if (typeof nlp !== 'function') {
                 console.warn('Compromise NLP library not available, falling back to basic splitting.');
                 // Fallback: Split by common punctuation followed by space/newline and uppercase letter
                  const basicSentences = text.split(/([.?!])\s+(?=[A-ZÀ-ÿ"']|\n|$)/g);
                  let result = [];
                  let currentSentence = "";
                  for(let i = 0; i < basicSentences.length; i++) {
                      currentSentence += basicSentences[i];
                      if (i % 2 === 1 || i === basicSentences.length - 1) { // Add punctuation back or it's the last part
                          if (currentSentence.trim()) {
                              result.push(currentSentence.trim());
                          }
                          currentSentence = "";
                      }
                  }
                  return result.map((s, i) => ({
                     text: s,
                     type: 'sentence',
                     paragraph: 1, // Assume single paragraph in fallback
                     sentenceInParagraph: i + 1,
                     originalIndex: i
                 }));
             }

             try {
                // Process paragraph by paragraph for better context
                const paragraphs = text.split(/\n\s*\n+/); // Split by one or more empty lines
                let result = [];
                let sentenceIndex = 0;
                let currentParagraphIndex = 0;

                 // Basic Title detection (first non-empty paragraph, short, no punctuation)
                 let titleFound = false;
                 if (paragraphs.length > 0 && paragraphs[0].trim().length < 80 && !/[.?!]$/.test(paragraphs[0].trim())) {
                     const firstPara = paragraphs.shift().trim();
                     if(firstPara){
                        result.push({
                            text: firstPara,
                            type: 'title',
                            paragraph: 0,
                            sentenceInParagraph: 1,
                            originalIndex: sentenceIndex++
                        });
                        titleFound = true;
                        currentParagraphIndex = 0; // Title is para 0
                     }
                 }


                paragraphs.forEach((paraText, pIdx) => {
                    paraText = paraText.trim();
                    if (!paraText) return; // Skip empty paragraphs

                    currentParagraphIndex++; // Increment for non-empty, non-title paragraphs
                    const doc = nlp(paraText);
                    const sentences = doc.sentences().out('array');
                    let sentenceInParagraphCounter = 0;

                    sentences.forEach(sentenceText => {
                        sentenceText = sentenceText.trim();
                        if (sentenceText) {
                             sentenceInParagraphCounter++;
                             result.push({
                                text: sentenceText,
                                type: 'sentence',
                                paragraph: currentParagraphIndex,
                                sentenceInParagraph: sentenceInParagraphCounter,
                                originalIndex: sentenceIndex++
                            });
                        }
                    });
                });
                return result;
             } catch(nlpError) {
                 console.error("Error during NLP sentence splitting:", nlpError);
                 showError("NLP断句失败，请检查原文格式。");
                 // Fallback or return empty
                 return [];
             }
        }
    }


    // Simplified Poetry Detection (can be refined)
    function isPoetryText(text) {
        if (!text) return false;
        const lines = text.split('\n');
        if (lines.length < 3) return false; // Need at least a few lines

        let shortLineCount = 0;
        let nonPuncEndCount = 0;
        let totalNonEmptyLines = 0;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.length > 0) {
                totalNonEmptyLines++;
                if (trimmedLine.length < 60) { // Heuristic: lines shorter than 60 chars
                    shortLineCount++;
                }
                if (!/[.!?;:,]$/.test(trimmedLine)) { // Doesn't end with common punctuation
                    nonPuncEndCount++;
                }
            }
        });

        if (totalNonEmptyLines < 3) return false;

        // Heuristic: If > 60% lines are short AND > 50% don't end with punctuation
        return (shortLineCount / totalNonEmptyLines > 0.6 && nonPuncEndCount / totalNonEmptyLines > 0.5);
    }


    function renderSentences(container, sentences, isSource = true) {
        container.innerHTML = ''; // Clear previous content

        if (!sentences || sentences.length === 0) {
            container.textContent = isSource ? '无源文本' : '无译文';
            if (isSource && emptyPrompt) { // Show prompt if source is empty
                 container.appendChild(emptyPrompt.cloneNode(true)); // Append a clone
                 container.querySelector('.empty-prompt').style.display = 'block';
            }
            return;
        }

        let currentParagraphElement = null;
        let currentParagraphIndex = -1;

        sentences.forEach((sentence) => {
            if (sentence.paragraph !== currentParagraphIndex) {
                // Append previous paragraph if it exists
                if (currentParagraphElement) {
                    container.appendChild(currentParagraphElement);
                }
                // Create new paragraph container
                currentParagraphElement = document.createElement('div');
                currentParagraphElement.className = 'paragraph';
                // Special class if poetry detected (though rendering logic might override)
                if (isCurrentTextPoetry) currentParagraphElement.classList.add('poetry-mode');
                currentParagraphIndex = sentence.paragraph;
            }

            // Handle empty lines specifically if using that type
             if (sentence.type === 'empty_line') {
                 const emptyLineDiv = document.createElement('div');
                 emptyLineDiv.className = 'empty-line';
                 emptyLineDiv.innerHTML = '&nbsp;'; // To maintain height
                 currentParagraphElement.appendChild(emptyLineDiv);
                 return; // Skip rest for empty lines
             }


            const sentenceElem = document.createElement('span');
            sentenceElem.className = 'sentence';
            sentenceElem.dataset.index = sentence.originalIndex;
            sentenceElem.dataset.paragraph = sentence.paragraph;
             sentenceElem.dataset.sentenceInParagraph = sentence.sentenceInParagraph;
             sentenceElem.dataset.type = sentence.type;

             // Add highlighting based on permanentHighlightIndex
             if (parseInt(sentence.originalIndex) === permanentHighlightIndex) {
                sentenceElem.classList.add('permanent-highlight');
             }


            // Sentence Number
            const sentenceNumber = document.createElement('span');
            sentenceNumber.className = 'sentence-number';
            if (sentence.type === 'title') {
                sentenceNumber.textContent = '[标题]';
                sentenceElem.style.fontWeight = 'bold'; // Style title sentence
                sentenceElem.style.display = 'block'; // Title on its own line
                sentenceElem.style.marginBottom = '1em';
            } else if (isCurrentTextPoetry && sentence.type === 'poetry_line') {
                 // Poetry: Use simple line number if available
                 sentenceNumber.textContent = `[${sentence.lineNumber || sentence.originalIndex + 1}]`;
                 sentenceElem.style.display = 'block'; // Each poetry line on its own line
                 // Apply indentation for poetry
                 if (sentence.indentation > 0) {
                     sentenceElem.style.paddingLeft = `${sentence.indentation * 0.6}em`; // Adjust multiplier as needed
                 }
            }
            else {
                sentenceNumber.textContent = `[${sentence.paragraph}.${sentence.sentenceInParagraph}]`;
            }
            sentenceElem.appendChild(sentenceNumber);

            // Sentence Text
            const textSpan = document.createElement('span');
            textSpan.className = 'sentence-text';
             // Use textContent to avoid interpreting potential HTML in translation
            textSpan.textContent = sentence.text;
            sentenceElem.appendChild(textSpan);

             // Missing translation marker
             if (!isSource && sentence.isMissing) {
                sentenceElem.classList.add('missing-translation');
             }


            // Add actions only to target sentences (and not titles)
            if (!isSource && sentence.type !== 'title') {
                 addSentenceActions(sentenceNumber, sentenceElem, sentence.originalIndex);
            }

            // Add event listeners for highlighting and interaction
            addSentenceEventListeners(sentenceElem);

            // Append sentence to the current paragraph
            if (currentParagraphElement) {
                currentParagraphElement.appendChild(sentenceElem);
                 // Add space between sentences in the same paragraph (unless poetry)
                 if (!isCurrentTextPoetry && sentence.type !== 'title') {
                    const nextSentence = sentences[sentence.originalIndex + 1];
                    if (nextSentence && nextSentence.paragraph === sentence.paragraph) {
                        currentParagraphElement.appendChild(document.createTextNode(' '));
                    }
                 }
            } else {
                // Should not happen if logic is correct, but fallback
                container.appendChild(sentenceElem);
                 if (!isCurrentTextPoetry && sentence.type !== 'title') {
                     container.appendChild(document.createTextNode(' '));
                 }
            }
        });

        // Append the last paragraph
        if (currentParagraphElement) {
            container.appendChild(currentParagraphElement);
        }
    }

    function addSentenceActions(numberElement, sentenceElement, index) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'sentence-actions';

        const retranslateBtn = document.createElement('button');
        retranslateBtn.className = 'sentence-action-btn';
        retranslateBtn.textContent = '重译';
        retranslateBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            hideAllActionButtons();
            retranslateSentence(index);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'sentence-action-btn';
        editBtn.textContent = '修改';
        editBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            hideAllActionButtons();
            enableEditMode(sentenceElement);
        });

        actionsDiv.appendChild(retranslateBtn);
        actionsDiv.appendChild(editBtn);
        numberElement.appendChild(actionsDiv);

        // Show actions on number click
        numberElement.addEventListener('click', function(event) {
            event.stopPropagation();
            // Hide others before showing current
            hideAllActionButtons();
            actionsDiv.style.display = 'block';
            activeActionButtons = actionsDiv;
        });
    }

     function addSentenceEventListeners(sentenceElem) {
        const index = parseInt(sentenceElem.dataset.index);

        sentenceElem.addEventListener('mouseover', () => {
             if (!activeEditElement) { // Don't highlight during edit
                highlightSentence(index, false, sentenceElem);
             }
        });
        sentenceElem.addEventListener('mouseout', () => {
             if (!activeEditElement) {
                clearHighlights();
             }
        });
        sentenceElem.addEventListener('click', () => {
             if (!activeEditElement) { // Don't toggle permanent highlight during edit
                 togglePermanentHighlight(index);
             }
        });
    }


    function getCleanTranslationText() {
        if (!currentTargetSentences || currentTargetSentences.length === 0) {
            return '';
        }

        // Group sentences by paragraph index
        const paragraphs = {};
        currentTargetSentences.forEach(sentence => {
             // Skip missing or error sentences for copy
             if (sentence.isMissing || sentence.text.startsWith('[翻译错误]')) return;

            const paraIndex = sentence.paragraph || 0; // Use 0 for titles or ungrouped
            if (!paragraphs[paraIndex]) {
                paragraphs[paraIndex] = [];
            }
            paragraphs[paraIndex].push(sentence);
        });

        let cleanText = '';
        // Sort paragraph keys numerically
        const sortedParaKeys = Object.keys(paragraphs).sort((a, b) => parseInt(a) - parseInt(b));

        sortedParaKeys.forEach((paraKey, idx) => {
            const sentencesInPara = paragraphs[paraKey];
            // Sort sentences within paragraph by their original order (or sentenceInParagraph)
            sentencesInPara.sort((a, b) => a.originalIndex - b.originalIndex);

             if (paraKey === '0' && sentencesInPara[0]?.type === 'title') {
                // Handle title separately
                 cleanText += sentencesInPara[0].text + '\n\n';
             } else if (isCurrentTextPoetry) {
                 // Poetry: Keep line breaks
                 sentencesInPara.forEach(s => {
                    // Try to reconstruct indentation based on source? Or just use translated text per line.
                    // Using rawText from source might be better if available and structure matches.
                    // For simplicity, just using translated text per line here.
                     cleanText += s.text + '\n';
                 });
                 // Add extra newline between poetry "stanzas" (paragraphs in our model)
                 if (idx < sortedParaKeys.length - 1) {
                     cleanText += '\n';
                 }

             }
             else {
                // Normal text: Join sentences with space, add double newline between paragraphs
                const paragraphText = sentencesInPara.map(s => s.text).join(' ');
                cleanText += paragraphText + '\n\n';
            }
        });

        return cleanText.trim(); // Trim final whitespace
    }

    // --- Highlighting ---

    function highlightSentence(index, isPermanent = false, sourceElement = null) {
        if (isNaN(index)) return;

        // If not permanent action, and there's a permanent highlight different from current, do nothing
        if (!isPermanent && permanentHighlightIndex !== -1 && permanentHighlightIndex !== index) {
             return;
        }

        clearHighlights(); // Clear previous temporary highlights

        const highlightClass = isPermanent ? 'permanent-highlight' : 'highlight';

        try {
            const sourceSentence = sourceContent.querySelector(`.sentence[data-index="${index}"]`);
            const targetSentence = targetContent.querySelector(`.sentence[data-index="${index}"]`);

            const isSourceContainer = sourceElement && sourceContent.contains(sourceElement);
            const isTargetContainer = sourceElement && targetContent.contains(sourceElement);

            if (sourceSentence) {
                sourceSentence.classList.add(highlightClass);
                // Scroll into view if highlighting permanently or triggered from the other pane
                 if (isPermanent || isTargetContainer) {
                    scrollToElement(sourceSentence, 'source-content');
                 }
            }
            if (targetSentence) {
                targetSentence.classList.add(highlightClass);
                // Scroll into view if highlighting permanently or triggered from the other pane
                 if (isPermanent || isSourceContainer) {
                    scrollToElement(targetSentence, 'target-content');
                 }
            }
        } catch (error) {
            console.error('Highlighting error:', error);
        }
    }

    function clearHighlights() {
         const selector = '.sentence.highlight'; // Only select temporary highlights
         document.querySelectorAll(selector).forEach(elem => {
             // Only remove temporary class, leave permanent one if present
             elem.classList.remove('highlight');
         });
    }

    function removeHighlightAndEvents() {
        // Clear all highlights (temp and perm)
        document.querySelectorAll('.sentence.highlight, .sentence.permanent-highlight').forEach(elem => {
            elem.classList.remove('highlight', 'permanent-highlight');
        });
        permanentHighlightIndex = -1; // Reset permanent highlight state

        // Detach event listeners? More complex, usually just letting elements be replaced by renderSentences is enough.
         if (activeEditElement) {
             cancelEditMode(); // Ensure edit mode is cancelled
         }
         hideAllActionButtons();
    }


    function togglePermanentHighlight(index) {
        console.log(`Toggling permanent highlight for index: ${index}. Current permanent: ${permanentHighlightIndex}`);
        const currentPermanentElementSource = sourceContent.querySelector(`.sentence[data-index="${permanentHighlightIndex}"]`);
        const currentPermanentElementTarget = targetContent.querySelector(`.sentence[data-index="${permanentHighlightIndex}"]`);
        const newElementSource = sourceContent.querySelector(`.sentence[data-index="${index}"]`);
        const newElementTarget = targetContent.querySelector(`.sentence[data-index="${index}"]`);


        // If clicking the currently highlighted sentence, remove highlight
        if (index === permanentHighlightIndex) {
            if (currentPermanentElementSource) currentPermanentElementSource.classList.remove('permanent-highlight');
            if (currentPermanentElementTarget) currentPermanentElementTarget.classList.remove('permanent-highlight');
            permanentHighlightIndex = -1;
             console.log("Removed permanent highlight.");
        } else {
            // Remove old permanent highlight if it exists
            if (currentPermanentElementSource) currentPermanentElementSource.classList.remove('permanent-highlight');
            if (currentPermanentElementTarget) currentPermanentElementTarget.classList.remove('permanent-highlight');

            // Add new permanent highlight
            if (newElementSource) newElementSource.classList.add('permanent-highlight');
            if (newElementTarget) newElementTarget.classList.add('permanent-highlight');
            permanentHighlightIndex = index;
             console.log(`Set permanent highlight to index: ${index}`);

             // Also apply temporary highlight effect immediately
             highlightSentence(index, true); // Call highlight to ensure scrolling etc.
        }
    }

    // Scroll helper
    function scrollToElement(element, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !element) return;

        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // Check if element is fully or partially outside the container's viewport
        const elementTopRelativeToContainer = elementRect.top - containerRect.top;
        const elementBottomRelativeToContainer = elementRect.bottom - containerRect.top;

        let scrollTo = container.scrollTop; // Default to current position

        if (elementTopRelativeToContainer < 0) {
            // Element is above the viewport, scroll up to bring it to top
            scrollTo = container.scrollTop + elementTopRelativeToContainer - 10; // Add small margin
        } else if (elementBottomRelativeToContainer > container.clientHeight) {
            // Element is below the viewport, scroll down to bring it to bottom
             scrollTo = container.scrollTop + (elementBottomRelativeToContainer - container.clientHeight) + 10; // Add small margin
        }
        // Only scroll if needed
        if (scrollTo !== container.scrollTop) {
             container.scrollTo({
                top: scrollTo,
                behavior: 'smooth'
             });
        }
    }

    // --- Sentence Editing ---

    function enableEditMode(sentenceElem) {
        if (activeEditElement) {
            // Ask to save/cancel previous edit first?
            // For now, just cancel previous silently
            cancelEditMode();
        }

        currentEditingIndex = parseInt(sentenceElem.dataset.index);
        const textElement = sentenceElem.querySelector('.sentence-text');
        if (!textElement || isNaN(currentEditingIndex)) return;

        activeEditElement = sentenceElem; // Store the whole sentence span
        const originalText = textElement.textContent; // Get current text
        sentenceElem.dataset.originalText = originalText; // Store for cancel

        // Add edit class to parent span
        sentenceElem.classList.add('edit-mode');
        textElement.style.display = 'none'; // Hide original text span

        // Create textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'sentence-edit-textarea';
        textarea.value = originalText;
        textarea.rows = Math.max(2, Math.ceil(originalText.length / 50)); // Basic auto-sizing guess

        // Insert textarea after the hidden text span
        textElement.parentNode.insertBefore(textarea, textElement.nextSibling);

        // Create controls div if it doesn't exist
        let controls = sentenceElem.querySelector('.edit-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.className = 'edit-controls';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'edit-btn save-edit-sentence-btn'; // Specific class
            saveBtn.textContent = '保存';
            saveBtn.addEventListener('click', () => saveEdit(sentenceElem));

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'edit-btn cancel-edit-sentence-btn'; // Specific class
            cancelBtn.textContent = '取消';
            cancelBtn.style.backgroundColor = '#888';
            cancelBtn.addEventListener('click', () => cancelEditMode());

            controls.appendChild(cancelBtn);
            controls.appendChild(saveBtn);
            sentenceElem.appendChild(controls); // Append controls to sentence span
        }
        controls.style.display = 'block'; // Ensure controls are visible

        textarea.focus();
        textarea.select(); // Select text

        // Highlight sentence being edited
        highlightSentence(currentEditingIndex, true); // Use permanent highlight style
    }

    function cancelEditMode() {
        if (!activeEditElement) return;

        const textElement = activeEditElement.querySelector('.sentence-text');
        const textarea = activeEditElement.querySelector('.sentence-edit-textarea');
        const controls = activeEditElement.querySelector('.edit-controls');

        if (textElement) {
            textElement.style.display = ''; // Show original text span
        }
        if (textarea) {
            textarea.remove(); // Remove textarea
        }
        if (controls) {
            controls.style.display = 'none'; // Hide controls
             // controls.remove(); // Or remove completely if recreated each time
        }

        activeEditElement.classList.remove('edit-mode'); // Remove edit class

        // Clear references
        const indexBeingEdited = currentEditingIndex; // Store before clearing
        activeEditElement = null;
        currentEditingIndex = -1;

         // Clear highlight *unless* it was the permanent one
         if (permanentHighlightIndex !== indexBeingEdited) {
            const sentenceElem = sourceContent.querySelector(`.sentence[data-index="${indexBeingEdited}"]`);
            if(sentenceElem) sentenceElem.classList.remove('highlight', 'permanent-highlight');
            const sentenceElemTgt = targetContent.querySelector(`.sentence[data-index="${indexBeingEdited}"]`);
            if(sentenceElemTgt) sentenceElemTgt.classList.remove('highlight', 'permanent-highlight');
         } else {
             // Re-apply permanent highlight if edit is cancelled on the permanent one
             highlightSentence(permanentHighlightIndex, true);
         }

        console.log("Edit cancelled.");
    }

    function saveEdit(sentenceElem) {
        const textarea = sentenceElem.querySelector('.sentence-edit-textarea');
        const textElement = sentenceElem.querySelector('.sentence-text');
        const index = parseInt(sentenceElem.dataset.index);

        if (!textarea || !textElement || isNaN(index) || index < 0 || index >= currentTargetSentences.length) {
            showError('无法保存修改：元素或索引无效。');
            return;
        }

        const newText = textarea.value.trim();
         const oldText = sentenceElem.dataset.originalText;

        if (newText === oldText) {
             showRealtimeHint("译文未更改。");
             cancelEditMode(); // Just exit edit mode
             return;
        }
        if (!newText) {
             showError("译文不能为空。");
             return; // Keep editing
        }


        showConfirmDialog(
            '确认要保存对该句子的修改吗？',
            () => { // OK Callback
                console.log(`Saving sentence ${index} edit.`);
                // Update data array
                currentTargetSentences[index].text = newText;
                currentTargetSentences[index].isMissing = false; // Mark as not missing

                // Update UI text span
                textElement.textContent = newText; // Use textContent
                textElement.style.display = ''; // Show text span

                // Clean up edit elements
                textarea.remove();
                const controls = sentenceElem.querySelector('.edit-controls');
                if (controls) controls.style.display = 'none'; // Hide controls
                sentenceElem.classList.remove('edit-mode'); // Remove edit class
                 sentenceElem.classList.remove('missing-translation'); // Remove missing marker

                // Clear references
                 const indexEdited = currentEditingIndex;
                 activeEditElement = null;
                 currentEditingIndex = -1;


                showRealtimeHint('句子修改已保存');

                 // Keep highlight if it was permanent, otherwise clear
                 if (permanentHighlightIndex !== indexEdited) {
                    clearHighlights();
                 } else {
                     highlightSentence(permanentHighlightIndex, true); // Re-apply permanent
                 }
            },
            () => { // Cancel Callback - Keep editing
                console.log("Save confirmation cancelled.");
                // Optionally refocus textarea?
                 textarea.focus();
            }
        );
    }

    // --- UI Helpers ---

    function showLoading(show) {
        loading.style.display = show ? 'block' : 'none';
        translateBtn.disabled = show;
        retryBtn.disabled = show; // Disable retry while loading
        if (show) {
             progressBar.style.display = 'block'; // Ensure progress bar is visible when loading starts
             statusMessage.style.display = 'block';
             stopBtn.style.display = 'inline-block'; // Show stop button
        } else {
            // Hide progress elements and stop button when loading finishes
            progressBar.style.display = 'none';
            statusMessage.style.display = 'none';
            stopBtn.style.display = 'none';
             stopBtn.disabled = false; // Re-enable for next run
             stopBtn.textContent = '停止翻译';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        console.error("Error Displayed:", message);
        // Optional: Auto-hide after a delay
        // setTimeout(() => {
        //     errorMessage.style.display = 'none';
        // }, 8000);
    }

    function clearError() {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }

    function showRealtimeHint(message) {
         if (hintTimeout) clearTimeout(hintTimeout); // Clear previous timeout
         realtimeHint.textContent = message;
         realtimeHint.classList.add('show'); // Use class for fade-in

         hintTimeout = setTimeout(() => {
             realtimeHint.classList.remove('show'); // Fade out
             // Optional: set display none after transition
             // setTimeout(() => { realtimeHint.style.display = 'none'; }, 500);
         }, 3000); // Show for 3 seconds
    }


    function showConfirmDialog(message, okCallback, cancelCallback) {
        confirmMessage.textContent = message;
        currentConfirmOkCallback = okCallback; // 存储 OK 回调
        currentConfirmCancelCallback = cancelCallback; // 存储 Cancel 回调
        confirmDialog.style.display = 'block';
        confirmOverlay.style.display = 'block';
        console.log("showConfirmDialog called, callbacks stored."); // ++ 日志
    }

    function hideConfirmDialog() {
        confirmDialog.style.display = 'none';
        confirmOverlay.style.display = 'none';
        console.log("hideConfirmDialog called."); // ++ 日志
        // 注意：这里不再清理回调引用，因为它们在按钮事件监听器中被执行后清理
    }

    function hideAllActionButtons() {
        document.querySelectorAll('.sentence-actions').forEach(actions => {
            actions.style.display = 'none';
        });
        activeActionButtons = null;
    }

    // Add any necessary styles dynamically if needed (e.g., for poetry)
    // function addPoetryStyles() { ... } // Implement if complex poetry styling is required


}); // End DOMContentLoaded