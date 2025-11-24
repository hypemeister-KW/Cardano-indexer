import { expect, test, describe, beforeAll, afterAll } from "bun:test";

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Helper function for API requests
async function apiRequest(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
    const data = await response.json().catch(() => ({}));
    return { response, data, status: response.status };
}

describe('Health Check Endpoint', () => {
    test('GET /health - should return healthy status', async () => {
        const { status, data } = await apiRequest('/health');

        expect(status).toBe(200);
        expect(data.status).toBe('ok');
        expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('GET /health - should have fast response time', async () => {
        const start = Date.now();
        const { status } = await apiRequest('/health');
        const duration = Date.now() - start;

        expect(status).toBe(200);
        expect(duration).toBeLessThan(1000); // < 1s
    });
});

describe('Reset Endpoints', () => {
    test('POST /reset - should reset sync state without clearing data', async () => {
        const { status, data } = await apiRequest('/reset', {
            method: 'POST',
            body: JSON.stringify({ clearData: false }),
        });

        expect(status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain('Sync state reset to block');
        expect(data.dataCleared).toBe(false);
    });

    test('POST /reset - should reset sync state with clearing data', async () => {
        const { status, data } = await apiRequest('/reset', {
            method: 'POST',
            body: JSON.stringify({ clearData: true }),
        });

        expect(status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.dataCleared).toBe(true);
    });

    test('GET /reset - should reset with query params', async () => {
        const { status, data } = await apiRequest('/reset?block=10000000&clearData=false');

        expect(status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain('Sync state reset to block');
    });
});

describe('Addresses Endpoints', () => {
    let testAddress: string;

    beforeAll(async () => {
        // Try to get a real address from top addresses
        const { data } = await apiRequest('/top-addresses?limit=1');
        if (data.topAddresses && data.topAddresses.length > 0) {
            testAddress = data.topAddresses[0].address;
        } else {
            // Fallback test address (will test 404 case)
            testAddress = 'addr1test123456789';
        }
    });

    test('GET /addresses/:address - should return 404 for non-existent address', async () => {
        const nonExistentAddress = 'addr1nonexistent123456789012345678901234567890';
        const { status, data } = await apiRequest(`/addresses/${nonExistentAddress}`);

        expect(status).toBe(404);
        expect(data.error).toBe('Address not found');
    });

    test('GET /addresses/:address - should return address data if exists', async () => {
        if (!testAddress || testAddress === 'addr1test123456789') {
            // Skip if no real address available
            return;
        }

        const { status, data } = await apiRequest(`/addresses/${testAddress}`);

        if (status === 200) {
            expect(data.address).toBe(testAddress);
            expect(typeof data.balance).toBe('number');
            expect(typeof data.transactionCount).toBe('number');
            expect(data.balance).toBeGreaterThanOrEqual(0);
            expect(data.transactionCount).toBeGreaterThanOrEqual(0);
        } else {
            expect(status).toBe(404);
        }
    });

    test('GET /addresses/:address/transactions - should return paginated transactions', async () => {
        if (!testAddress || testAddress === 'addr1test123456789') {
            return;
        }

        const { status, data } = await apiRequest(
            `/addresses/${testAddress}/transactions?page=1&limit=10`
        );

        expect(status).toBe(200);
        expect(data.transactions).toBeInstanceOf(Array);
        expect(data.page).toBe(1);
        expect(data.limit).toBe(10);

        if (data.transactions.length > 0) {
            const tx = data.transactions[0];
            expect(tx).toHaveProperty('txHash');
            expect(tx).toHaveProperty('blockHeight');
            expect(tx).toHaveProperty('blockTime');
            expect(tx).toHaveProperty('inputs');
            expect(tx).toHaveProperty('outputs');
        }
    });

    test('GET /addresses/:address/transactions - should handle default pagination', async () => {
        if (!testAddress || testAddress === 'addr1test123456789') {
            return;
        }

        const { status, data } = await apiRequest(
            `/addresses/${testAddress}/transactions`
        );

        expect(status).toBe(200);
        expect(data.page).toBe(1);
        expect(data.limit).toBe(10);
    });

    test('GET /addresses/:address/transactions - should handle invalid page parameter', async () => {
        if (!testAddress || testAddress === 'addr1test123456789') {
            return;
        }

        const { status } = await apiRequest(
            `/addresses/${testAddress}/transactions?page=invalid&limit=10`
        );

        // Should either return 200 with default values or handle error gracefully
        expect([200, 400]).toContain(status);
    });

    test('GET /top-addresses - should return top addresses by balance', async () => {
        const { status, data } = await apiRequest('/top-addresses?limit=10');

        expect(status).toBe(200);
        expect(data.topAddresses).toBeInstanceOf(Array);
        expect(data.topAddresses.length).toBeLessThanOrEqual(10);

        if (data.topAddresses.length > 1) {
            // Check sorting (descending by balance)
            for (let i = 0; i < data.topAddresses.length - 1; i++) {
                expect(data.topAddresses[i].balance).toBeGreaterThanOrEqual(
                    data.topAddresses[i + 1].balance
                );
            }
        }

        // Check structure of each address
        data.topAddresses.forEach((addr: any) => {
            expect(addr).toHaveProperty('address');
            expect(addr).toHaveProperty('balance');
            expect(addr).toHaveProperty('transactionCount');
            expect(typeof addr.balance).toBe('number');
            expect(addr.balance).toBeGreaterThan(0); // Top addresses should have balance > 0
        });
    });

    test('GET /top-addresses - should handle default limit', async () => {
        const { status, data } = await apiRequest('/top-addresses');

        expect(status).toBe(200);
        expect(data.topAddresses).toBeInstanceOf(Array);
        expect(data.topAddresses.length).toBeLessThanOrEqual(10);
    });

    test('GET /top-addresses - should handle custom limit', async () => {
        const { status, data } = await apiRequest('/top-addresses?limit=5');

        expect(status).toBe(200);
        expect(data.topAddresses.length).toBeLessThanOrEqual(5);
    });
});

describe('Transactions Endpoint', () => {
    let testTxHash: string;

    beforeAll(async () => {
        // Try to get a real transaction hash from an address
        const { data: topAddresses } = await apiRequest('/top-addresses?limit=1');
        if (topAddresses.topAddresses && topAddresses.topAddresses.length > 0) {
            const address = topAddresses.topAddresses[0].address;
            const { data: transactions } = await apiRequest(
                `/addresses/${address}/transactions?limit=1`
            );
            if (transactions.transactions && transactions.transactions.length > 0) {
                testTxHash = transactions.transactions[0].txHash;
            }
        }

        if (!testTxHash) {
            testTxHash = 'nonexistent123456789';
        }
    });

    test('GET /transactions/:txHash - should return 404 for non-existent transaction', async () => {
        const nonExistentHash = 'nonexistent123456789012345678901234567890123456789012345678901234567890';
        const { status, data } = await apiRequest(`/transactions/${nonExistentHash}`);

        expect(status).toBe(404);
        expect(data.error).toBe('Transaction not found');
    });

    test('GET /transactions/:txHash - should return transaction data if exists', async () => {
        if (!testTxHash || testTxHash === 'nonexistent123456789') {
            return;
        }

        const { status, data } = await apiRequest(`/transactions/${testTxHash}`);

        if (status === 200) {
            expect(data.txHash).toBe(testTxHash);
            expect(typeof data.blockHeight).toBe('number');
            expect(typeof data.blockTime).toBe('number');
            expect(Array.isArray(data.inputs)).toBe(true);
            expect(Array.isArray(data.outputs)).toBe(true);

            // Check input structure
            if (data.inputs.length > 0) {
                expect(data.inputs[0]).toHaveProperty('address');
                expect(data.inputs[0]).toHaveProperty('amount');
            }

            // Check output structure
            if (data.outputs.length > 0) {
                expect(data.outputs[0]).toHaveProperty('address');
                expect(data.outputs[0]).toHaveProperty('amount');
            }
        } else {
            expect(status).toBe(404);
        }
    });
});

describe('Integration Tests', () => {
    test('End-to-end: Reset -> Top Addresses -> Address Details -> Transactions', async () => {
        // Step 1: Reset (optional, might clear data)
        // Skipping reset to avoid clearing test data

        // Step 2: Get top addresses
        const { data: topAddresses } = await apiRequest('/top-addresses?limit=1');

        if (topAddresses.topAddresses && topAddresses.topAddresses.length > 0) {
            const address = topAddresses.topAddresses[0].address;

            // Step 3: Get address details
            const { data: addressData } = await apiRequest(`/addresses/${address}`);

            if (addressData.address) {
                expect(addressData.address).toBe(address);

                // Step 4: Get address transactions
                const { data: transactions } = await apiRequest(
                    `/addresses/${address}/transactions?limit=1`
                );

                expect(transactions.transactions).toBeInstanceOf(Array);

                // Step 5: Get transaction details if available
                if (transactions.transactions.length > 0) {
                    const txHash = transactions.transactions[0].txHash;
                    const { data: txData } = await apiRequest(`/transactions/${txHash}`);

                    expect(txData.txHash).toBe(txHash);
                }
            }
        }
    });

    test('Pagination: should return different results for different pages', async () => {
        const { data: topAddresses } = await apiRequest('/top-addresses?limit=1');

        if (topAddresses.topAddresses && topAddresses.topAddresses.length > 0) {
            const address = topAddresses.topAddresses[0].address;

            const { data: page1 } = await apiRequest(
                `/addresses/${address}/transactions?page=1&limit=2`
            );

            const { data: page2 } = await apiRequest(
                `/addresses/${address}/transactions?page=2&limit=2`
            );

            if (page1.transactions.length > 0 && page2.transactions.length > 0) {
                // Transactions should be different
                const page1Hashes = page1.transactions.map((tx: any) => tx.txHash);
                const page2Hashes = page2.transactions.map((tx: any) => tx.txHash);

                // Check that there's no overlap (assuming we have enough transactions)
                const overlap = page1Hashes.filter((hash: string) => page2Hashes.includes(hash));
                expect(overlap.length).toBe(0);
            }
        }
    });
});

describe('Error Handling', () => {
    test('All endpoints should return proper error format', async () => {
        const endpoints = [
            '/addresses/invalid123',
            '/transactions/invalid123',
        ];

        for (const endpoint of endpoints) {
            const { status, data } = await apiRequest(endpoint);

            if (status >= 400) {
                expect(data).toHaveProperty('error');
                expect(typeof data.error).toBe('string');
            }
        }
    });
});

describe('Performance Tests', () => {
    test('Health endpoint should respond quickly', async () => {
        const iterations = 10;
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await apiRequest('/health');
            times.push(Date.now() - start);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / iterations;
        const maxTime = Math.max(...times);

        console.log(`Health endpoint - Avg: ${avgTime}ms, Max: ${maxTime}ms`);
        expect(avgTime).toBeLessThan(500); // Average should be < 500ms
    });
});

