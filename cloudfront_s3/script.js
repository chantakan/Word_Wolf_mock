document.addEventListener('DOMContentLoaded', function() {
    // DOM要素
    const guessForm = document.getElementById('guess-form');
    const guessInput = document.getElementById('guess-input');
    const messageContainer = document.getElementById('message-container');
    const historyContainer = document.getElementById('history-container');
    const apiModeToggle = document.getElementById('api-mode');
    
    // ゲーム設定
    const MAX_ATTEMPTS = 6;
    let attemptCount = 0;
    let gameOver = false;
    
    // ローカルモード用のダミーの答え (APIモードでは使用しない)
    const LOCAL_TARGET_WORD = "CLOUD";
    
    // API設定
    const API_ENDPOINT = ""; // Lambda+API Gatewayチームから提供されるエンドポイント
    
    // IndexedDB (SQLiteの代わり) を使用して履歴を保存
    let db;
    const DB_NAME = 'wordGuessDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'guessHistory';
    
    // IndexedDBの初期化
    function initDB() {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = function(event) {
            console.error("IndexedDB error:", event.target.error);
        };
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp', { unique: false });
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            loadHistory();
        };
    }
    
    // 履歴の保存
    function saveGuess(guess, result) {
        if (!db) return;
        
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        store.add({
            guess: guess,
            result: result,
            timestamp: new Date().getTime()
        });
    }
    
    // 履歴の読み込み
    function loadHistory() {
        if (!db) return;
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        
        const request = index.openCursor(null, 'prev');
        
        historyContainer.innerHTML = '';
        attemptCount = 0;
        
        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor && attemptCount < MAX_ATTEMPTS) {
                const data = cursor.value;
                displayGuessResult(data.guess, data.result);
                attemptCount++;
                cursor.continue();
            }
        };
    }
    
    // フォーム送信処理
    guessForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (gameOver) {
            showMessage("ゲームは終了しています。リロードして再開してください。");
            return;
        }
        
        const guess = guessInput.value.toUpperCase();
        
        if (guess.length !== 5) {
            showMessage("5文字の単語を入力してください");
            return;
        }
        
        if (attemptCount >= MAX_ATTEMPTS) {
            showMessage("試行回数の上限に達しました");
            return;
        }
        
        // APIモードかローカルモードかを判定
        if (apiModeToggle.checked) {
            // APIモード: Lambda関数を呼び出す
            checkWordWithAPI(guess);
        } else {
            // ローカルモード: フロントエンドで処理
            const result = checkWordLocally(guess);
            processResult(guess, result);
        }
        
        guessInput.value = '';
    });
    
    // APIを使用して単語をチェック
    async function checkWordWithAPI(guess) {
        try {
            showMessage("APIと通信中...");
            
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ word: guess })
            });
            
            if (!response.ok) {
                throw new Error('API response was not ok');
            }
            
            const data = await response.json();
            processResult(guess, data);
            
        } catch (error) {
            console.error('API Error:', error);
            showMessage("APIエラー: " + error.message);
        }
    }
    
    // ローカルで単語をチェック (APIを使わない)
    function checkWordLocally(guess) {
        const targetWord = LOCAL_TARGET_WORD;
        const result = [];
        const targetChars = targetWord.split('');
        
        // 1回目のパス: 完全一致をチェック
        for (let i = 0; i < 5; i++) {
            if (guess[i] === targetChars[i]) {
                result[i] = { letter: guess[i], status: 'correct' };
                targetChars[i] = null; // 使用済みとしてマーク
            } else {
                result[i] = { letter: guess[i], status: 'unknown' };
            }
        }
        
        // 2回目のパス: 含まれるが位置が違う文字をチェック
        for (let i = 0; i < 5; i++) {
            if (result[i].status === 'unknown') {
                const targetIndex = targetChars.indexOf(guess[i]);
                if (targetIndex >= 0) {
                    result[i].status = 'present';
                    targetChars[targetIndex] = null; // 使用済みとしてマーク
                } else {
                    result[i].status = 'absent';
                }
            }
        }
        
        const isCorrect = guess === targetWord;
        
        return {
            result: result,
            isCorrect: isCorrect,
            message: isCorrect ? '正解です！' : '続けてください'
        };
    }
    
    // 結果を処理
    function processResult(guess, data) {
        displayGuessResult(guess, data.result);
        saveGuess(guess, data.result);
        
        attemptCount++;
        
        if (data.isCorrect) {
            showMessage("おめでとうございます！正解です！", true);
            gameOver = true;
        } else if (attemptCount >= MAX_ATTEMPTS) {
            showMessage(`ゲームオーバー！正解は ${apiModeToggle.checked ? "???" : LOCAL_TARGET_WORD} でした。`);
            gameOver = true;
        } else {
            showMessage(data.message || "");
        }
    }
    
    // 推測結果を表示
    function displayGuessResult(guess, result) {
        const guessRow = document.createElement('div');
        guessRow.className = 'guess-row';
        
        for (let i = 0; i < 5; i++) {
            const letterBox = document.createElement('div');
            letterBox.className = 'letter-box';
            
            if (result && result[i]) {
                letterBox.textContent = result[i].letter;
                letterBox.classList.add(result[i].status);
            } else {
                letterBox.textContent = guess[i];
            }
            
            guessRow.appendChild(letterBox);
        }
        
        historyContainer.appendChild(guessRow);
    }
    
    // メッセージを表示
    function showMessage(message, isSuccess = false) {
        messageContainer.textContent = message;
        messageContainer.className = isSuccess ? 'success-message' : '';
    }
    
    // ページロード時にDBを初期化
    initDB();
    
    // APIモードの切り替え時の処理
    apiModeToggle.addEventListener('change', function() {
        if (this.checked) {
            // APIモードに切り替え
            showMessage("APIモードに切り替えました。Lambda+API Gatewayと通信します。");
            
            // APIエンドポイントが設定されているか確認
            if (API_ENDPOINT === "REPLACE_WITH_API_ENDPOINT") {
                showMessage("API_ENDPOINTが設定されていません。script.jsを編集してください。");
                this.checked = false;
            }
        } else {
            // ローカルモードに切り替え
            showMessage("ローカルモードに切り替えました。フロントエンドのみで動作します。");
        }
        
        // ゲームをリセット
        resetGame();
    });
    
    // ゲームのリセット
    function resetGame() {
        historyContainer.innerHTML = '';
        attemptCount = 0;
        gameOver = false;
        showMessage("");
        
        // 履歴をクリア
        if (db) {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.clear();
        }
    }
});