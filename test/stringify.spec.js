'use strict';

const { expect } = require('chai');
const stringify = require('../src/util/stringify');

describe('stringify select', () => {
    context('tests copied from github.com/godmodelabs/flora-client-js', () => {
        it('should stringify simple arrays', () => {
            expect(stringify(['id', 'name'])).to.equal('id,name');
        });

        it('should handle objects', () => {
            expect(stringify({ groupA: ['attr1', 'attr2'] })).to.equal('groupA[attr1,attr2]');
        });

        it('should handle simple key/value objects', () => {
            expect(stringify({ key: 'value' })).to.equal('key.value');
        });

        it('should handle nested arrays', () => {
            const spec = [
                'id',
                'name',
                ['attr1', 'attr2'],
            ];

            expect(stringify(spec)).to.equal('id,name,attr1,attr2');
        });

        it('should handle nested objects', () => {
            const spec = {
                group1: { group2: 'value' },
            };

            expect(stringify(spec)).to.equal('group1.group2.value');
        });

        it('should handle nested items', () => {
            const spec = [
                'id',
                'name',
                { subGroup: ['attr1', 'attr2'] },
                'attr',
            ];

            expect(stringify(spec)).to.equal('id,name,subGroup[attr1,attr2],attr');
        });

        it('should handle deeply nested items', () => {
            const spec = [
                'id',
                'name',
                {
                    subGroupA: [
                        'id',
                        'name',
                        {
                            subSubGroupA: ['attr1', 'attr2'],
                            subSubGroupB: [
                                { subSubSubGroupA: ['attr1', 'attr2'] },
                                'subSubSubItem',
                                { subSubSubGroupB: ['attr1', 'attr2'] },
                            ],
                        },
                    ],
                },
                'attr',
            ];

            const selectString = 'id,name,subGroupA[id,name,subSubGroupA[attr1,attr2],subSubGroupB[subSubSubGroupA[attr1,attr2],subSubSubItem,subSubSubGroupB[attr1,attr2]]],attr';
            expect(stringify(spec)).to.equal(selectString);
        });

        it('should not use brackets for single item groups', () => {
            expect(stringify({ subGroup: ['attr'] })).to.equal('subGroup.attr');
        });
    });

    context('found bugs', () => {
        it('deep object are not correctly parsed', () => {
            const toParse = [{ a: [{ b: ['bb'], c: ['cc'] }] }];
            expect(stringify(toParse)).to.be.equal('a[b.bb,c.cc]');
        });
    });
});
