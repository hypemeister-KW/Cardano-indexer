import * as readline from 'readline';

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
    return new Promise(resolve => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
}

async function getCLIInput() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false  // DODANE
    });

    console.log('=================================');
    console.log('   Cardano Indexer - Setup');
    console.log('=================================\n');

    try {
        const startBlock = await askQuestion(rl, '📦 Enter starting block (START_BLOCK): ');
        const endBlock = await askQuestion(rl, '🏁 Enter ending block (END_BLOCK): ');

        rl.close();
        
        const startBlockNum = parseInt(startBlock);
        const endBlockNum = parseInt(endBlock);

        if (isNaN(startBlockNum) || isNaN(endBlockNum)) {
            console.error('❌ Error: Blocks must be numbers!');
            process.exit(1);
        }

        if (startBlockNum >= endBlockNum) {
            console.error('❌ Error: Starting block must be less than ending block!');
            process.exit(1);
        }

        console.log('\n=================================');
        console.log(`✅ Start block: ${startBlockNum}`);
        console.log(`✅ End block: ${endBlockNum}`);
        console.log(`📊 Blocks to synchronize: ${endBlockNum - startBlockNum}`);
        console.log('=================================\n');

        process.env.START_BLOCK = startBlockNum.toString();
        process.env.END_BLOCK = endBlockNum.toString();

        return { startBlock: startBlockNum, endBlock: endBlockNum };
    } catch (error) {
        console.error('❌ An error occurred:', error);
        rl.close();
        process.exit(1);
    }
}

export { getCLIInput };