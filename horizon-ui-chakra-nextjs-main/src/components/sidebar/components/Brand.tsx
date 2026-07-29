// Chakra imports
import { Flex, Icon, IconButton, Text, useColorModeValue } from '@chakra-ui/react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

// Custom components
import { RyvlMark } from 'components/icons/RyvlMark';
import { HSeparator } from 'components/separator/Separator';

type SidebarBrandProps = {
	isCollapsed?: boolean;
	onToggleCollapse?: () => void;
};

// Was the stock Horizon template logo, then a plain "Market Intel" text
// mark - now the actual Ryvl brand mark + wordmark. The collapse toggle
// used to be a separately absolute-positioned button floating above this
// row (needing a big top margin here just to stay clear of it, and looking
// disconnected/out of place) - now it's part of the same row, so there's
// no more floating element to clear and no more oversized top gap.
export function SidebarBrand({ isCollapsed, onToggleCollapse }: SidebarBrandProps) {
	let textColor = useColorModeValue('navy.700', 'white');
	let toggleHoverBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.100');

	return (
		<Flex alignItems='center' flexDirection='column'>
			<Flex
				alignItems='center'
				justifyContent={isCollapsed ? 'center' : 'space-between'}
				w='100%'
				px={isCollapsed ? '0' : '16px'}
				pt='16px'
				pb='16px'
			>
				<Flex alignItems='center' gap='10px'>
					<RyvlMark size={isCollapsed ? 26 : 28} />
					{!isCollapsed && (
						<Text fontWeight='bold' fontSize='20px' color={textColor}>
							Ryvl
						</Text>
					)}
				</Flex>
				{!isCollapsed && (
					<IconButton
						aria-label='Collapse sidebar'
						icon={<Icon as={MdChevronLeft} boxSize='18px' />}
						size='sm'
						variant='ghost'
						borderRadius='full'
						onClick={onToggleCollapse}
						_hover={{ bg: toggleHoverBg }}
					/>
				)}
			</Flex>
			{isCollapsed && (
				<IconButton
					aria-label='Expand sidebar'
					icon={<Icon as={MdChevronRight} boxSize='18px' />}
					size='sm'
					variant='ghost'
					borderRadius='full'
					mb='12px'
					onClick={onToggleCollapse}
					_hover={{ bg: toggleHoverBg }}
				/>
			)}
			<HSeparator mb='20px' />
		</Flex>
	);
}

export default SidebarBrand;
