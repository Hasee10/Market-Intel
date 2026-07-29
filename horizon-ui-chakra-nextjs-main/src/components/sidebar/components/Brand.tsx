// Chakra imports
import { Flex, Text, useColorModeValue } from '@chakra-ui/react';

// Custom components
import { HSeparator } from 'components/separator/Separator';

type SidebarBrandProps = {
	isCollapsed?: boolean;
};

// Was the stock Horizon template logo (HorizonLogo SVG) - replaced with the
// actual product name. Collapses to a "MI" monogram instead of hiding
// entirely, so there's still a visible brand mark in the rail state.
export function SidebarBrand({ isCollapsed }: SidebarBrandProps) {
	let textColor = useColorModeValue('navy.700', 'white');

	return (
		<Flex alignItems='center' flexDirection='column'>
			<Text
				fontWeight='bold'
				fontSize={isCollapsed ? '18px' : '22px'}
				color={textColor}
				my='32px'
				transition='font-size 0.2s ease'
			>
				{isCollapsed ? 'MI' : 'Market Intel'}
			</Text>
			<HSeparator mb='20px' />
		</Flex>
	);
}

export default SidebarBrand;
