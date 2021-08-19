const assert = require('assert');
const app = require('../src/app');
const request = require('supertest');

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

});
