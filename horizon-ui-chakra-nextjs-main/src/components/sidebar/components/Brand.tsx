// Chakra imports
import { Flex, Text, useColorModeValue } from '@chakra-ui/react';

// Custom components
import { RyvlMark } from 'components/icons/RyvlMark';
import { HSeparator } from 'components/separator/Separator';

type SidebarBrandProps = {
	isCollapsed?: boolean;
};

// Was the stock Horizon template logo, then a plain "Market Intel" text
// mark - now the actual Ryvl brand mark + wordmark, collapsing to just the
// mark (no text) in the rail state.
export function SidebarBrand({ isCollapsed }: SidebarBrandProps) {
	let textColor = useColorModeValue('navy.700', 'white');

	return (
		<Flex alignItems='center' flexDirection='column'>
			<Flex alignItems='center' gap='10px' mt='40px' mb='16px'>
				<RyvlMark size={isCollapsed ? 26 : 30} />
				{!isCollapsed && (
					<Text fontWeight='bold' fontSize='22px' color={textColor}>
						Ryvl
					</Text>
				)}
			</Flex>
			<HSeparator mb='20px' />
		</Flex>
	);
}

export default SidebarBrand;
