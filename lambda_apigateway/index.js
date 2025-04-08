exports.handler = async (event) => {
    const TARGET_WORD = process.env.TARGET_WORD || "CLOUD"; // 環境変数から正解を取得
    
    console.log("Event received:", JSON.stringify(event));
    
    // リクエストボディのパース
    let body;
    try {
          // APIGatewayからのリクエストまたは直接のテストイベントに対応
          body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
          console.log("Parsed body:", JSON.stringify(body));
      } catch (error) {
          console.error("Error parsing request body:", error);
          return formatResponse(400, { error: 'Invalid request body' });
      }
    
    // wordはevent.bodyの中にあるか、eventそのものの中にあるかのどちらか
    const guess = ((body.word) || (body.body && body.body.word) || "").toUpperCase();
    console.log("Received guess:", guess);
    
    // 入力チェック
    if (guess.length !== 5) {
        return formatResponse(400, { error: '5文字の単語を入力してください' });
    }
    
    // ヒント生成ロジック
    const result = [];
    const targetChars = TARGET_WORD.split('');
    
    // 1回目のパス: 完全一致をチェック
    for (let i = 0; i < 5; i++) {
        if (guess[i] === targetChars[i]) {
            result[i] = { letter: guess[i], status: 'correct' }; // 緑：正解
            targetChars[i] = null; // 使用済みとしてマーク
        } else {
            result[i] = { letter: guess[i], status: 'unknown' }; // 暫定的に不明としておく
        }
    }
    
    // 2回目のパス: 含まれるが位置が違う文字をチェック
    for (let i = 0; i < 5; i++) {
        if (result[i].status === 'unknown') {
            const targetIndex = targetChars.indexOf(guess[i]);
            if (targetIndex >= 0) {
                result[i].status = 'present'; // 黄：含まれるが位置が違う
                targetChars[targetIndex] = null; // 使用済みとしてマーク
            } else {
                result[i].status = 'absent'; // 灰：含まれない
            }
        }
    }
    
    // 勝利判定
    const isCorrect = guess === TARGET_WORD;
    
    // レスポンス作成
    const responseBody = {
        result: result,
        isCorrect: isCorrect,
        message: isCorrect ? '正解です！' : '続けてください'
    };
    
    console.log("Response:", JSON.stringify(responseBody));
    return formatResponse(200, responseBody);
  };
  
  // レスポンスをフォーマットするヘルパー関数
  function formatResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // CORS対応
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify(body)
    };
  }