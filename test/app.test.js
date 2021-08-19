const assert = require('assert');
const app = require('../src/app');
const request = require('supertest');

//// Normally I would create another database for testing, here I use the seed data for testing so npm seed would be required in order for all tests to pass

describe('CONTRACTS', () => {

    describe('GET /contracts/:id', () => {

        it('should trow an error for missing profile_id', () => {
            return request(app).get('/contracts/1')
            .expect(401);
        });

        it('should trow an error for non-existing profile_id', () => {
            return request(app).get('/contracts/1')
            .set({
                profile_id: 10000
            })
            .expect(401);
        });

        it('should get a contract for a client', () => {
            return request(app).get('/contracts/1')
            .set({
                profile_id: 1
            })
            .expect(200)
            .then(result => {
                assert(result.body.id == 1);
            });
        });

        it('should get a contract for a contractor', () => {
            return request(app).get('/contracts/1')
            .set({
                profile_id: 5
            })
            .expect(200)
            .then(result => {
                assert(result.body.id == 1);
            });
        });

        it('should trow an error for trying to access others people contract', () => {
            return request(app).get('/contracts/1')
            .set({
                profile_id: 2
            })
            .expect(403);
        });

    });

    describe('GET /contracts', () => {

        it('should return non-terminated contracts', () => {
            return request(app).get('/contracts')
            .set({
                profile_id: 1
            })
            .expect(200)
            .then(result => {
                assert(result.body.length == 1);
            });
        });

    });
})

describe('JOBS', () => {

    describe('GET /jobs/unpaid', () => {

        it('should return non-paid jobs from in-progress contract ', () => {
            return request(app).get('/jobs/unpaid')
            .set({
                profile_id: 1
            })
            .expect(200)
            .then(result => {
                assert(result.body.length == 1);
            });
        });

        it('should return non-paid jobs from in-progress contract ', () => {
            return request(app).get('/jobs/unpaid')
            .set({
                profile_id: 2
            })
            .expect(200)
            .then(result => {
                assert(result.body.length == 2);
            });
        });

    });


    describe('POST /jobs/:job_id/pay', () => {

        it('should trow error for trying to pay as contractor', () => {
            return request(app).post('/jobs/1/pay')
            .set({
                profile_id: 5
            })
            .expect(400)
        });

        it('should pay the job', () => {
            return request(app).post('/jobs/1/pay')
            .set({
                profile_id: 1
            })
            .expect(200)
        });

        it('should trow error for already payd job', () => {
            return request(app).post('/jobs/1/pay')
            .set({
                profile_id: 1
            })
            .expect(400)
        });

        it('should trow error for low balance', () => {
            return request(app).post('/jobs/5/pay')
            .set({
                profile_id: 4
            })
            .expect(400)
        });

    });
})


describe('JOBS', () => {

    describe('POST /balances/deposit/:userId', () => {

        it('should trow error for missing depositAmount', () => {
            return request(app).post("/balances/deposit/1")
            .expect(400)
        });

        it('should trow error for non-existing user', () => {
            return request(app).post("/balances/deposit/100000")
            .send({
                depositAmount: 50
            })
            .expect(404)
        });

        it('should add the the user balance', () => {
            return request(app).post("/balances/deposit/1")
            .send({
                depositAmount: 50
            })
            .expect(200)
        });

        it('should trow error for too big depositAmount', () => {
            return request(app).post('/balances/deposit/1')
            .send({
                depositAmount: 51
            })
            .expect(400)
        });

    });
});
