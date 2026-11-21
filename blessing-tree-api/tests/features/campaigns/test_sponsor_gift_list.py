from types import SimpleNamespace

import pytest

from app.features.campaigns.sponsor_gift_list import format_sponsor_gift_list, recipient_age_label


@pytest.mark.parametrize(('age', 'unit', 'expected'), [
    (8, 'YEARS', '8 years'), (1, 'YEARS', '1 year'), (0, 'YEARS', '0 years'),
    (8, 'MONTHS', '8 months'), (1, 'MONTHS', '1 month'), (None, 'YEARS', ''),
])
def test_age_labels_preserve_units(age, unit, expected):
    assert recipient_age_label(SimpleNamespace(age=age, age_unit=unit)) == expected
    assert recipient_age_label(None) == ''


def test_gifts_are_grouped_even_when_recipient_rows_are_interleaved():
    def row(key, description):
        return {'recipient_key': key, 'recipient_label': 'Anonymous', 'description': description,
                'age': '8 years', 'gender': 'Female', 'status': 'READY_FOR_PICKUP', 'quantity': '2'}
    result = format_sponsor_gift_list([row('a', 'Coat'), row('b', 'Doll'), row('a', 'Shoes')])
    sections = result.split('\n\n')
    assert len(sections) == 2
    assert sections[0] == ('Anonymous (Age: 8 years; Gender: Female)\n'
                           '  • Coat (Ready For Pickup, Qty 2)\n'
                           '  • Shoes (Ready For Pickup, Qty 2)')
    assert 'Doll' in sections[1]
    assert format_sponsor_gift_list([]) == ''
